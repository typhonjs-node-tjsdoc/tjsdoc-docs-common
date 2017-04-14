import fs   from 'fs';
import path from 'path';

/**
 * The base StaticDoc.
 *
 * The following tags / annotations are supported by DocBase and children implementations:
 *
 * `@abstract`, `@access`, `@deprecated`, `@desc`, `@emits`, `@example`, `@experimental`, `@ignore`, `@listens`,
 * `@param`, `@override`, `@private`, `@property`, `@protected`, `@public`, `@return`, `@returns`, `@see`, `@since`,
 * `@throws`, `@todo`, `@type`, `@version`
 */
export default class DocBase
{
   /**
    * Creates doc data statically held.
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
    *
    * @returns {DocBase}
    */
   static create(docID, moduleID, ast, node, pathResolver, commentTags = [], eventbus)
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

      /**
       * Store all supported path extensions for import file name resolution when no extensions are present.
       * @type {string[]}
       */
      this._pathExtensions = eventbus.triggerSync('tjsdoc:data:config:get').pathExtensions;

      /**
       * Provides an object hash storing which dynamic methods have already been applied.
       * @type {{}}
       * @private
       */
      this._appliedMethods = {};

      /**
       * Stores all values parsed from doc tags.
       * @type {{}}
       * @private
       */
      this._value = {};

      this._value.__docId__ = docID;

      // If a module / file ID is defined then set it.
      this._value.__esModuleId__ = moduleID;

      // Specially apply kind, category, and name methods now so that it appears at the top of the doc object data.
      this._ensureApplied('_$kind');
      this._ensureApplied('_$qualifier');
      this._ensureApplied('_$name');

      this._value.filePath = this._pathResolver.filePath;

      // All docs are considered static until set otherwise.
      this._value.static = true;

      this._apply();
      this._processCommentTags();

      // Save doc name in the AST node such that it is accessible for MemberDoc / MethodDoc `_$memberof`.
      this._node._tjsdocDocName = this._value.name;

      // Ensures that the AST node is added last in doc object data.
      this._value.node = this._node;

      // Ensures that the complete AST for the file / module is accessible.
      this._value.ast = this._ast;

      return this;
   }

   /**
    * apply doc comment.
    * @private
    */
   static _apply()
   {
      // Invoke all value parsing functions functions starting with `_$`.
      const dynamicMethods = s_GET_DYNAMIC_INVOKE_METHODS(this);

      // Used in testing to sort alphabetically all dynamic invoke methods to catch any missing `_ensureApplied` usage.
      // dynamicMethods.sort();

      for (const methodName of dynamicMethods)
      {
         if (!this._appliedMethods[methodName])
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
   static _ensureApplied(methodName)
   {
      if (!this._appliedMethods[methodName])
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
   static _find(names)
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
   static _findAll(names)
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
   static _findAllTagValues(names)
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
    * Find class in same file, import or external.
    *
    * Note: this only works for directly exported nodes and not intermediate exports. Intermediate nodes like
    * `export default <variable>` or `export default new Class()` need special processing in DocGenerator
    * `_processDefaultExport` & `_processNamedExport`.
    *
    * @param {string} className - target class name.
    *
    * @returns {string} found class long name.
    * @private
    */
   static _findClassLongname(className)
   {
      // Find exported class name in file.
      // Note: this only works for directly exported nodes and not intermediate exports.
      // Intermediate nodes like `export default <variable>` or `export default new Class()` need special processing
      // in DocGenerator `_processDefaultExport` & `_processNamedExport`.
      const exportNode = this._eventbus.triggerSync('tjsdoc:system:ast:export:declaration:class:find', this._ast,
       className);

      if (exportNode) { return `${this._pathResolver.filePath}~${className}`; }

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
   static _findTagValue(names)
   {
      const tag = this._find(names);

      return tag ? tag.tagValue : null;
   }

   /** @type {DocObject[]} */
   static get value()
   {
      return this._value;
   }

   /**
    * decide `unknown`.
    */
   static _processCommentTags()
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
    * Deletes all non-function keys in this static doc including all collated data. The `_value` object is however
    * retained and returned, but deleted along with all other local non-function keys of `this` to ensure that it goes
    * out of scope. This for instance prevents a copy of `_value` when loading into a `DocDB` instance.
    *
    * @returns {{}}
    */
   static reset()
   {
      const value = this._value;

      // Delete all local keys that are not a function.
      for (const key of Object.keys(this))
      {
         if (typeof this[key] !== 'function') { delete this[key]; }
      }

      return value;
   }

   /**
    * resolve long name.
    * if the name relates import path, consider import path.
    * @param {string} name - identifier name.
    * @returns {string} resolved name.
    * @private
    */
   static _resolveLongname(name)
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
    * The following methods provide the @xxx tags / annotations supported in DocBase. Adding methods makes it easy
    * to detect any unknown tags when a method is missing. Child classes may also add the tags that they support.
    */

   /** @ignore */ static _tag_abstract() {}
   /** @ignore */ static _tag_access() {}
   /** @ignore */ static _tag_deprecated() {}
   /** @ignore */ static _tag_desc() {}
   /** @ignore */ static _tag_emits() {}
   /** @ignore */ static _tag_example() {}
   /** @ignore */ static _tag_experimental() {}
   /** @ignore */ static _tag_ignore() {}
   /** @ignore */ static _tag_listens() {}
   /** @ignore */ static _tag_param() {}
   /** @ignore */ static _tag_override() {}
   /** @ignore */ static _tag_private() {}
   /** @ignore */ static _tag_property() {}
   /** @ignore */ static _tag_protected() {}
   /** @ignore */ static _tag_public() {}
   /** @ignore */ static _tag_return() {}
   /** @ignore */ static _tag_returns() {}
   /** @ignore */ static _tag_see() {}
   /** @ignore */ static _tag_since() {}
   /** @ignore */ static _tag_throws() {}
   /** @ignore */ static _tag_todo() {}
   /** @ignore */ static _tag_type() {}
   /** @ignore */ static _tag_version() {}

   /**
    * decide `abstract`.
    */
   static _$abstract()
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
   static _$access()
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
   static _$decorator()
   {
      this._value.decorators = this._eventbus.triggerSync('tjsdoc:system:ast:decorators:find', this._node);
   }

   /**
    * decide `deprecated`.
    */
   static _$deprecated()
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
   static _$desc()
   {
      this._value.description = this._findTagValue(['@desc']);
   }

   /**
    * decide `emits`.
    */
   static _$emits()
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
   static _$example()
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
   static _$experimental()
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
   static _$ignore()
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
   static _$longname()
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
   static _$lineNumber()
   {
      this._value.lineNumber = this._eventbus.triggerSync('tjsdoc:system:ast:line:number:start:find', this._node);
   }

   /**
    * decide `listens`.
    */
   static _$listens()
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
   static _$override()
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
   static _$param()
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
    * decide `property`.
    */
   static _$property()
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
    * decide `return`.
    */
   static _$return()
   {
      const value = this._findTagValue(['@return', '@returns']);

      if (!value) { return; }

      this._value.return = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
       { type: true, name: false, desc: true });
   }

   /**
    * decide `see`.
    */
   static _$see()
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
   static _$since()
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
   static _$todo()
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
   static _$throws()
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
   static _$type()
   {
      const value = this._findTagValue(['@type']);

      if (!value) { return; }

      this._value.type = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
       { type: true, name: false, desc: false });
   }

   /**
    * decide `undocument` with internal tag.
    */
   static _$undocument()
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
   static _$version()
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
         if (!props.includes(prop) && prop !== 'arguments' && prop !== 'caller' && target[prop] instanceof Function &&
          prop.startsWith('_$'))
         {
            props.push(prop);
         }
      });

      obj = Object.getPrototypeOf(obj);
   } while (typeof obj !== 'undefined' && obj !== null && !(obj === Object.prototype));

   return props;
};
