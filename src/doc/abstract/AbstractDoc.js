import fs   from 'fs';
import path from 'path';

/**
 * Abstract Doc Class.
 *
 * The following tags / annotations are supported by AbstractDoc and children implementations:
 *
 * `@abstract`, `@access`, `@deprecated`, `@desc`, `@emits`, `@example`, `@experimental`, `@ignore`, `@listens`,
 * `@param`, `@override`, `@private`, `@property`, `@protected`, `@public`, `@return`, `@returns`, `@see`, `@since`,
 * `@throws`, `@todo`, `@type`, `@version`
 */
export default class AbstractDoc
{
   /**
    * create instance.
    *
    * @param {number}            docID - The docID for this doc.
    *
    * @param {number|null}       moduleID - The docID for the corresponding module / file.
    *
    * @param {AST}               ast - The AST that contains this doc.
    *
    * @param {ASTNode}           node - The AST node for this doc object.
    *
    * @param {PathResolver}      pathResolver - The file path resolver that contains this doc.
    *
    * @param {Tag[]}             commentTags - The comment tags associated with this doc object.
    *
    * @param {EventProxy}        eventbus - An event proxy for the main eventbus.
    */
   constructor(docID, moduleID, ast, node, pathResolver, commentTags = [], eventbus)
   {
      /**
       * The AST that contains this doc.
       * @type {AST}
       * @private
       */
      this._ast = ast;

      /**
       * The AST node for this doc object.
       * @type {ASTNode}
       * @private
       */
      this._node = node;

      /**
       * The file path resolver that contains this doc.
       * @type {PathResolver}
       * @private
       */
      this._pathResolver = pathResolver;

      /**
       * The comment tags associated with this doc object.
       * @type {Tag[]}
       * @private
       */
      this._commentTags = commentTags;

      /**
       * An event proxy for the main eventbus.
       * @type {EventProxy}
       * @private
       */
      this._eventbus = eventbus;

      //
      /**
       * Store all supported path extensions for import file name resolution when no extensions are present.
       * @type {string[]}
       */
      this._pathExtensions = eventbus.triggerSync('tjsdoc:data:config:get').pathExtensions;

      /**
       * Stores all values parsed from doc tags.
       * @type {{}}
       * @private
       */
      this._value = {};

      Reflect.defineProperty(this._node, 'doc', { value: this });

      this._value.__docId__ = docID;

      // If a module / file ID is defined then set it.
      this._value.__esModuleId__ = moduleID;

      this._value.filePath = this._pathResolver.filePath;

      // All docs are considered static until set otherwise.
      this._value.static = true;

      /**
       * Provides an object hash storing which dynamic methods have already been applied.
       * @type {{}}
       * @private
       */
      this._appliedMethods = {};

      this._apply();
      this._processCommentTags();
   }

   /**
    * apply doc comment.
    * @protected
    */
   _apply()
   {
      // Invoke all value parsing functions functions starting with `_$`.
      const dynamicMethods = s_GET_DYNAMIC_INVOKE_METHODS(this);

      // Used in testing to sort alphabetically all dynamic invoke methods to catch any missing `_ensureApplied` usage.
      // dynamicMethods.sort();

      for (const methodName of dynamicMethods)
      {
         if (typeof this._appliedMethods[methodName] === 'undefined')
         {
            this[methodName]();
            this._appliedMethods[methodName] = true;
         }
      }
   }

   /**
    * Ensures that a method has been invoked. This is useful for the dynamic dispatch of all methods starting with `_$`
    * allowing any given method to ensure that a dependent method setting a value in `this._value` has been applied.
    *
    * @param {string}   methodName - The method name to check applied or invoke.
    *
    * @private
    */
   _ensureApplied(methodName)
   {
      if (typeof this._appliedMethods[methodName] === 'undefined')
      {
         if (this[methodName] instanceof Function)
         {
            this[methodName]();
         }
         else
         {
            const config = this._eventbus.triggerSync('tjsdoc:data:config:get');

            if (config.debug)
            {
               throw new TypeError(`this.${methodName} is not a function.`);
            }
         }

         this._appliedMethods[methodName] = true;
      }
   }

   /**
    * find last tag.
    * @param {string[]} names - tag names.
    * @returns {Tag|null} found tag.
    * @protected
    */
   _find(names)
   {
      const results = this._findAll(names);

      return results && results.length ? results[results.length - 1] : null;
   }

   /**
    * find all tags.
    * @param {string[]} names - tag names.
    * @returns {Tag[]|null} found tags.
    * @private
    */
   _findAll(names)
   {
      const results = [];

      for (const tag of this._commentTags)
      {
         if (names.includes(tag.tagName)) { results.push(tag); }
      }

      return results.length ? results : null;
   }

   /**
    * find all tag values.
    * @param {string[]} names - tag names.
    * @returns {*[]|null} found values.
    * @private
    */
   _findAllTagValues(names)
   {
      const tags = this._findAll(names);

      if (!tags) { return null; }

      const results = [];

      for (const tag of tags)
      {
         results.push(tag.tagValue);
      }

      return results;
   }

   /**
    * find class in same file, import or external.
    * @param {string} className - target class name.
    * @returns {string} found class long name.
    * @private
    */
   _findClassLongname(className)
   {
      // find in same file.
      for (const node of this._ast.program.body)
      {
         if (!['ExportDefaultDeclaration', 'ExportNamedDeclaration'].includes(node.type)) { continue; }

         if (node.declaration && node.declaration.type === 'ClassDeclaration' && node.declaration.id.name === className)
         {
            return `${this._pathResolver.filePath}~${className}`;
         }
      }

      // find in import.
      const importPath = this._eventbus.triggerSync('tjsdoc:system:ast:path:import:declaration:find', this._ast,
       className);

      if (importPath) { return this._resolveLongname(className); }

      // find in external
      return className;
   }

   /**
    * find ta value.
    * @param {string[]} names - tag names.
    * @returns {*|null} found value.
    * @private
    */
   _findTagValue(names)
   {
      const tag = this._find(names);

      return tag ? tag.tagValue : null;
   }

   /** @type {DocObject[]} */
   get value()
   {
      return JSON.parse(JSON.stringify(this._value));
   }

   /**
    * resolve long name.
    * if the name relates import path, consider import path.
    * @param {string} name - identifier name.
    * @returns {string} resolved name.
    * @private
    */
   _resolveLongname(name)
   {
      const importPath = this._eventbus.triggerSync('tjsdoc:system:ast:path:import:declaration:find', this._ast, name);

      if (!importPath) { return name; }

      if (importPath.charAt(0) === '.' || importPath.charAt(0) === '/')
      {
         let resolvedPath;

         // Attempt to guess extension type and verify that it exists.
         if (!path.extname(importPath))
         {
            // By default append `.js` to import path, but this is only used if none of the supported path extensions
            // resolve below.
            resolvedPath = this._pathResolver.resolve(`${importPath}.js`);

            for (const extension of this._pathExtensions)
            {
               // Must test full path then resolve relative path.
               const testPath = this._pathResolver.resolveAbsolutePath(`${importPath}${extension}`);

               if (fs.existsSync(testPath))
               {
                  resolvedPath = this._pathResolver.resolve(`${importPath}${extension}`);

                  break;
               }
            }
         }
         else
         {
            resolvedPath = this._pathResolver.resolve(importPath);
         }

         return `${resolvedPath}~${name}`; // longname
      }
      else
      {
         return `${importPath}~${name}`; // longname
      }
   }

   /**
    * The following methods provide the @xxx tags / annotations supported in AbstractDoc. Adding methods makes it easy
    * to detect any unknown tags when a method is missing. Child classes may also add the tags that they support.
    */

   /** @ignore */ _tag_abstract() {}
   /** @ignore */ _tag_access() {}
   /** @ignore */ _tag_deprecated() {}
   /** @ignore */ _tag_desc() {}
   /** @ignore */ _tag_emits() {}
   /** @ignore */ _tag_example() {}
   /** @ignore */ _tag_experimental() {}
   /** @ignore */ _tag_ignore() {}
   /** @ignore */ _tag_listens() {}
   /** @ignore */ _tag_param() {}
   /** @ignore */ _tag_override() {}
   /** @ignore */ _tag_private() {}
   /** @ignore */ _tag_property() {}
   /** @ignore */ _tag_protected() {}
   /** @ignore */ _tag_public() {}
   /** @ignore */ _tag_return() {}
   /** @ignore */ _tag_returns() {}
   /** @ignore */ _tag_see() {}
   /** @ignore */ _tag_since() {}
   /** @ignore */ _tag_throws() {}
   /** @ignore */ _tag_todo() {}
   /** @ignore */ _tag_type() {}
   /** @ignore */ _tag_version() {}

   /**
    * decide `abstract`.
    */
   _$abstract()
   {
      const tag = this._find(['@abstract']);

      if (tag)
      {
         this._value.abstract = true;
      }
   }

   /**
    * decide `access`.
    * process also @public, @private and @protected.
    */
   _$access()
   {
      const tag = this._find(['@access', '@public', '@private', '@protected']);
      if (tag)
      {
         let access;

         switch (tag.tagName)
         {
            case '@access':
               access = tag.tagValue;
               break;

            case '@public':
               access = 'public';
               break;

            case '@protected':
               access = 'protected';
               break;

            case '@private':
               access = 'private';
               break;

            default:
               throw new Error(`unexpected token: ${tag.tagName}`);
         }

         this._value.access = access;
      }
      else
      {
         this._value.access = null;
      }
   }

   /**
    * decide `decorator`.
    */
   _$decorator()
   {
      this._value.decorators = this._eventbus.triggerSync('tjsdoc:system:ast:decorators:find', this._node);
   }

   /**
    * decide `deprecated`.
    */
   _$deprecated()
   {
      const tag = this._find(['@deprecated']);

      if (tag)
      {
         if (tag.tagValue)
         {
            this._value.deprecated = tag.tagValue;
         }
         else
         {
            this._value.deprecated = true;
         }
      }
   }

   /**
    * decide `description`.
    */
   _$desc()
   {
      this._value.description = this._findTagValue(['@desc']);
   }

   /**
    * decide `emits`.
    */
   _$emits()
   {
      const values = this._findAllTagValues(['@emits']);

      if (!values) { return; }

      this._value.emits = [];

      for (const value of values)
      {
         const result = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
          { type: true, name: false, desc: true });

         this._value.emits.push({ types: result.types, description: result.description });
      }
   }

   /**
    * decide `examples`.
    */
   _$example()
   {
      const tags = this._findAll(['@example']);

      if (!tags) { return; }
      if (!tags.length) { return; }

      this._value.examples = [];

      for (const tag of tags)
      {
         this._value.examples.push(tag.tagValue);
      }
   }

   /**
    * decide `experimental`.
    */
   _$experimental()
   {
      const tag = this._find(['@experimental']);

      if (tag)
      {
         if (tag.tagValue)
         {
            this._value.experimental = tag.tagValue;
         }
         else
         {
            this._value.experimental = true;
         }
      }
   }

   /**
    * decide `ignore`.
    */
   _$ignore()
   {
      const tag = this._find(['@ignore']);

      if (tag)
      {
         this._value.ignore = true;
      }
   }

   /**
    * decide `longname`.
    */
   _$longname()
   {
      this._ensureApplied('_$memberof');
      this._ensureApplied('_$name');
      this._ensureApplied('_$static');

      const memberof = this._value.memberof;
      const name = this._value.name;
      const scope = this._value.static ? '.' : '#';

      if (memberof.includes('~'))
      {
         this._value.longname = `${memberof}${scope}${name}`;
      }
      else
      {
         this._value.longname = `${memberof}~${name}`;
      }
   }

   /**
    * decide `lineNumber`.
    */
   _$lineNumber()
   {
      this._value.lineNumber = this._eventbus.triggerSync('tjsdoc:system:ast:line:number:start:find', this._node);
   }

   /**
    * decide `listens`.
    */
   _$listens()
   {
      const values = this._findAllTagValues(['@listens']);

      if (!values) { return; }

      this._value.listens = [];

      for (const value of values)
      {
         const result = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
          { type: true, name: false, desc: true });

         this._value.listens.push({ types: result.types, description: result.description });
      }
   }

   /**
    * decide `override`.
    */
   _$override()
   {
      const tag = this._find(['@override']);

      if (tag)
      {
         this._value.override = true;
      }
   }

   /**
    * decide `param`.
    */
   _$param()
   {
      const values = this._findAllTagValues(['@param']);

      if (!values) { return; }

      this._value.params = [];

      for (const value of values)
      {
         const result = this._eventbus.triggerSync('tjsdoc:system:parser:param:value:parse', value);

         if (!result.typeText || !result.paramName)
         {
            this._eventbus.trigger('tjsdoc:system:invalid:code:add',
             { filePath: this._pathResolver.absolutePath, node: this._node });

            continue;
         }

         this._value.params.push(this._eventbus.triggerSync('tjsdoc:system:parser:param:from:value:parse', result));
      }
   }

   /**
    * decide `unknown`.
    */
   _processCommentTags()
   {
      for (const tag of this._commentTags)
      {
         const methodName = tag.tagName.replace(/^[@]/, '_tag_');

         // If this class, including children implementations, has a matching `_tag_<methodName>` method then the tag
         // is marked as known and handled by this class otherwise it is marked as an unknown tag.
         if (typeof this[methodName] === 'function')
         {
            if (!this._value.tagsKnown) { this._value.tagsKnown = []; }

            this._value.tagsKnown.push(tag);
         }
         else
         {
            if (!this._value.tagsUnknown) { this._value.tagsUnknown = []; }

            this._value.tagsUnknown.push(tag);
         }
      }
   }

   /**
    * decide `property`.
    */
   _$property()
   {
      const values = this._findAllTagValues(['@property']);

      if (!values) { return; }

      this._value.properties = [];

      for (const value of values)
      {
         this._value.properties.push(this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value));
      }
   }

   /**
    * decide `pseudoExport`.
    */
   _$pseudoExport()
   {
      if (this._node.__PseudoExport__)
      {
         this._value.pseudoExport = true;
      }
   }

   /**
    * decide `return`.
    */
   _$return()
   {
      const value = this._findTagValue(['@return', '@returns']);

      if (!value) { return; }

      this._value.return = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
       { type: true, name: false, desc: true });
   }

   /**
    * decide `see`.
    */
   _$see()
   {
      const tags = this._findAll(['@see']);

      if (!tags) { return; }
      if (!tags.length) { return; }

      this._value.see = [];

      for (const tag of tags)
      {
         this._value.see.push(tag.tagValue);
      }
   }

   /**
    * decide `since`.
    */
   _$since()
   {
      const tag = this._find(['@since']);

      if (tag)
      {
         this._value.since = tag.tagValue;
      }
   }

   /**
    * decide `todo`.
    */
   _$todo()
   {
      const tags = this._findAll(['@todo']);

      if (tags)
      {
         this._value.todo = [];

         for (const tag of tags)
         {
            this._value.todo.push(tag.tagValue);
         }
      }
   }

   /**
    * decide `throws`.
    */
   _$throws()
   {
      const values = this._findAllTagValues(['@throws']);

      if (!values) { return; }

      this._value.throws = [];

      for (const value of values)
      {
         const result = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
          { type: true, name: false, desc: true });

         this._value.throws.push({ types: result.types, description: result.description });
      }
   }

   /**
    * decide `type`.
    */
   _$type()
   {
      const value = this._findTagValue(['@type']);

      if (!value) { return; }

      this._value.type = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
       { type: true, name: false, desc: false });
   }

   /**
    * decide `undocument` with internal tag.
    */
   _$undocument()
   {
      const tag = this._find(['@_undocument']);

      if (tag)
      {
         this._value.undocument = true;
      }
   }

   /**
    * decide `version`.
    */
   _$version()
   {
      const tag = this._find(['@version']);

      if (tag)
      {
         this._value.version = tag.tagValue;
      }
   }
}

/**
 * Walks an objects inheritance tree collecting property names that are methods and start with `_$` indicating that
 * they are a dynamic invoke method which parses or processes tag values.
 *
 * @param {object}   obj - object to walks.
 *
 * @returns {Array<string>}
 * @ignore
 */
const s_GET_DYNAMIC_INVOKE_METHODS = (obj) =>
{
   const props = [];
   const target = obj;

   do
   {
      Object.getOwnPropertyNames(obj).forEach((prop) =>
      {
         if (props.indexOf(prop) === -1 && target[prop] instanceof Function && prop.startsWith('_$'))
         {
            props.push(prop);
         }
      });

      obj = Object.getPrototypeOf(obj);
   } while (typeof obj !== 'undefined' && obj !== null && !(obj === Object.prototype));

   return props;
};
