/**
 * Resolves various core properties in DocDB / TaffyDB data.
 */
export default class CoreDocResolver
{
   /**
    * Wires up CoreDocResolver.
    *
    * @param {PluginEvent}    ev - An event proxy for the main this._eventbus.
    */
   onPluginLoad(ev)
   {
      /**
       * Stores the plugin eventbus proxy.
       * @type {EventProxy}
       */
      this._eventbus = ev.eventbus;

      this._eventbus.on('tjsdoc:system:resolver:docdb:resolve', this.resolve, this);
   }

   /**
    * Stores the target project TJSDocConfig and main DocDB so that eventbus queries are reduced.
    *
    * @param {PluginEvent}    ev - An event proxy for the main this._eventbus.
    */
   onPreGenerate(ev)
   {
      this._mainConfig = ev.data.mainConfig;

      this._mainDocDB = ev.data.docDB;
   }

   /**
    * Resolve various properties.
    *
    * @param {DocDB}    [docDB=this._mainDocDB] - The target DocDB to resolve. Defaults to the main DocDB.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @param {boolean}  [silent=false] - If true then logging is not output for each resolution stage.
    *
    */
   resolve({ docDB = this._mainDocDB, filePath = void 0, silent = false } = {})
   {
      // Must remove common path first as `longname`, `memberof, and `name` are modified.
      if (this._mainConfig.removeCommonPath)
      {
         if (!silent) { this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: removing common path'); }
         this._resolveCommonPath(docDB, filePath);
      }

      if (!silent) { this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve extends chain'); }
      this._resolveExtendsChain(docDB, filePath);

      if (!silent) { this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve necessary'); }
      this._resolveNecessary(docDB, filePath);

      if (!silent) { this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve access'); }
      this._resolveAccess(docDB, filePath);

      if (!silent)
      {
         this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve unexported identifier');
      }

      this._resolveUnexportIdentifier(docDB, filePath);

      if (!silent)
      {
         this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve undocumented identifier');
      }

      this._resolveUndocumentIdentifier(docDB, filePath);

      if (!silent) { this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve duplication'); }
      this._resolveDuplication(docDB, filePath);

      if (!silent) { this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve ignored'); }
      this._resolveIgnore(docDB, filePath);

      this._resolveTestRelation(docDB, filePath, silent);
   }

   /**
    * Resolve access property. If doc does not have access property, the doc is public. but if the name starts with '_',
    * the doc is considered private if TJSDocConfig parameter `autoPrivate` is true.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    * @private
    */
   _resolveAccess(docDB, filePath)
   {
      const access = this._mainConfig.access || ['public', 'protected', 'private'];
      const autoPrivate = this._mainConfig.autoPrivate;

      docDB.query(filePath ? { filePath } : void 0).update(function()
      {
         if (!this.access)
         {
            /** @ignore */
            this.access = autoPrivate && this.name.charAt(0) === '_' ? 'private' : 'public';
         }

         if (!access.includes(this.access))
         {
            /** @ignore */
            this.ignore = true;
         }

         return this;
      });
   }

   /**
    * Removes any common path from all docs that are not `memory` or `external`.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    * @private
    */
   _resolveCommonPath(docDB, filePath)
   {
      const docs = filePath ?
       docDB.find({ kind: { '!is': 'ModuleMemory', filePath } }, { kind: { '!is': 'VirtualExternal', filePath } }) :
        docDB.find({ kind: { '!is': 'ModuleMemory' } }, { kind: { '!is': 'VirtualExternal' } });

      if (docs.length === 0) { return; }

      let commonPath = this._eventbus.triggerSync('typhonjs:util:file:path:common:mapped', 'filePath', ...docs);

      if (commonPath === '') { return; }

      this._eventbus.trigger('log:info:raw', `tjsdoc-doc-resolver-core - common path removed: ${commonPath}`);

      // Escape commonPath.
      commonPath = commonPath.replace(/[\\]/g, '\\');
      commonPath = commonPath.replace(/[\/]/g, '\\/');

      const regex = new RegExp(`^${commonPath}`);

      // Remove the common path from all longname, memberof, and name fields.
      for (const doc of docs)
      {
         if (doc.longname) { doc.longname = doc.longname.replace(regex, ''); }
         if (doc.memberof) { doc.memberof = doc.memberof.replace(regex, ''); }
         if (doc.name) { doc.name = doc.name.replace(regex, ''); }
      }
   }

   /**
    * Resolve duplicated identifiers. Member docs are possible duplication sources. Other docs are not considered
    * duplicates.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @private
    */
   _resolveDuplication(docDB, filePath)
   {
      const docs = docDB.find(filePath ? { kind: ['ClassMember', 'ClassProperty'], filePath } :
       { kind: ['ClassMember', 'ClassProperty'] });

      const ignoreId = [];

      for (const doc of docs)
      {
         // member duplicate with getter/setter/method. when it, remove member. getter/setter/method are high priority.
         const nonMemberDup = docDB.find(
          { longname: doc.longname, kind: 'ClassMethod', qualifier: ['get', 'method', 'set'] });

         if (nonMemberDup.length)
         {
            ignoreId.push(doc.___id);
            continue;
         }

         const dup = docDB.find({ longname: doc.longname, kind: ['ClassMember', 'ClassProperty'] });

         if (dup.length > 1)
         {
            const ids = dup.map((v) => v.___id);

            ids.sort((a, b) => { return a < b ? -1 : 1; });
            ids.shift();

            ignoreId.push(...ids);
         }
      }

      docDB.query({ ___id: ignoreId }).update(function()
      {
         this.ignore = true;

         return this;
      });
   }

   /**
    * Resolve class extends chain.
    *
    * Add following special properties:
    * - ``_custom_dependent_file_paths``: file paths for all dependent files.
    * - ``_custom_direct_implemented``: class list that directly implements target doc.
    * - ``_custom_direct_subclasses``: class list that directly extends target doc.
    * - ``_custom_extends_chain``: ancestor class chain.
    * - ``_custom_indirect_implemented``: class list that indirectly implements target doc.
    * - ``_custom_indirect_implements``: class list that indirectly implements target doc.
    * - ``_custom_indirect_subclasses``: class list that indirectly extends target doc.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @private
    */
   _resolveExtendsChain(docDB, filePath)
   {
      /**
       * Tracks which docs need to initialize `_custom_<X>` lists.
       * @type {{}}
       */
      const seenData = {};

      /**
       * Stores data in `seenData` by doc.longname -> `_custom_<X>` list name tracking which docs need to initialize
       * `_custom_<X>` lists. This is necessary to reinitialize as resolving can occur multiple times across the
       * same data.
       *
       * @param {DocObject}   doc - DocObject to test.
       *
       * @param {string}      type - `_custom_<X>` list name.
       *
       * @returns {boolean} Result if whether the custom list name for the given doc object has already been seen.
       */
      const seen = (doc, type) =>
      {
         if (typeof seenData[doc.longname] !== 'object') { seenData[doc.longname] = {}; }

         const docData = seenData[doc.longname];

         const typeSeen = docData[type] || false;

         docData[type] = true;

         return typeSeen;
      };

      const extendsChain = (doc) =>
      {
         if (!doc.extends) { return; }

         const selfDoc = doc;

         // traverse super class.
         const chains = [];

//TODO FINISH!
         const backward_file_dependencies = [];

         do
         {
            const superClassDoc = docDB.findByName(doc.extends[0])[0];

            if (superClassDoc)
            {
               // this is circular extends
               if (superClassDoc.longname === selfDoc.longname) { break; }

               chains.push(superClassDoc.longname);
               backward_file_dependencies.push(superClassDoc.filePath);

               doc = superClassDoc;
            }
            else
            {
               chains.push(doc.extends[0]);

               break;
            }
         } while (doc.extends);


         if (chains.length)
         {
            // direct subclass
            let superClassDoc = docDB.findByName(chains[0])[0];

            if (superClassDoc)
            {
               if (!seen(superClassDoc, '_custom_direct_subclasses')) { superClassDoc._custom_direct_subclasses = []; }

               if (!seen(superClassDoc, '_custom_dependent_file_paths'))
               {
                  superClassDoc._custom_dependent_file_paths = [];
               }

               superClassDoc._custom_direct_subclasses.push(selfDoc.longname);

               superClassDoc._custom_dependent_file_paths.push(selfDoc.filePath);
            }

            // indirect subclass
            for (const superClassLongname of chains.slice(1))
            {
               superClassDoc = docDB.findByName(superClassLongname)[0];

               if (superClassDoc)
               {
                  if (!seen(superClassDoc, '_custom_indirect_subclasses'))
                  {
                     superClassDoc._custom_indirect_subclasses = [];
                  }

                  if (!seen(superClassDoc, '_custom_dependent_file_paths'))
                  {
                     superClassDoc._custom_dependent_file_paths = [];
                  }

                  superClassDoc._custom_indirect_subclasses.push(selfDoc.longname);

                  superClassDoc._custom_dependent_file_paths.push(selfDoc.filePath);
               }
            }

            // indirect implements and mixes
            for (const superClassLongname of chains)
            {
               superClassDoc = docDB.findByName(superClassLongname)[0];

               if (!superClassDoc) { continue; }

               // indirect implements
               if (superClassDoc.implements)
               {
                  if (!seen(selfDoc, '_custom_indirect_implements')) { selfDoc._custom_indirect_implements = []; }

                  selfDoc._custom_indirect_implements.push(...superClassDoc.implements);
               }
            }

            // extends chains
            selfDoc._custom_extends_chains = chains.reverse();
         }
      };

      const implemented = (doc) =>
      {
         const selfDoc = doc;

         // direct implemented (like direct subclass)
         for (const superClassLongname of selfDoc.implements || [])
         {
            const superClassDoc = docDB.findByName(superClassLongname)[0];

            if (!superClassDoc) { continue; }

            if (!seen(superClassDoc, '_custom_direct_implemented')) { superClassDoc._custom_direct_implemented = []; }

            if (!seen(superClassDoc, '_custom_dependent_file_paths'))
            {
               superClassDoc._custom_dependent_file_paths = [];
            }

            superClassDoc._custom_direct_implemented.push(selfDoc.longname);

            superClassDoc._custom_dependent_file_paths.push(selfDoc.filePath);
         }

         // indirect implemented (like indirect subclass)
         for (const superClassLongname of selfDoc._custom_indirect_implements || [])
         {
            const superClassDoc = docDB.findByName(superClassLongname)[0];

            if (!superClassDoc) { continue; }

            if (!seen(superClassDoc, '_custom_indirect_implemented'))
            {
               superClassDoc._custom_indirect_implemented = [];
            }

            if (!seen(superClassDoc, '_custom_dependent_file_paths'))
            {
               superClassDoc._custom_dependent_file_paths = [];
            }

            superClassDoc._custom_indirect_implemented.push(selfDoc.longname);

            superClassDoc._custom_dependent_file_paths.push(selfDoc.filePath);
         }
      };

      const docs = filePath ? docDB.find({ kind: 'ModuleClass', filePath }) : docDB.find({ kind: 'ModuleClass' });

      for (const doc of docs)
      {
         extendsChain(doc);
         implemented(doc);
      }

      // Add _custom_dependent_file_paths to all file docs adding any dependencies parsed for classes.
      for (const doc of docs)
      {
         if (Array.isArray(doc._custom_dependent_file_paths))
         {
            const fileDoc = docDB.find({ kind: 'ModuleFile', filePath: doc.filePath })[0];

            if (!seen(fileDoc, '_custom_dependent_file_paths')) { fileDoc._custom_dependent_file_paths = []; }

            for (const filePath of doc._custom_dependent_file_paths)
            {
               if (!fileDoc._custom_dependent_file_paths.includes(filePath))
               {
                  fileDoc._custom_dependent_file_paths.push(filePath);
               }
            }
         }
      }
   }

   /**
    * Resolve ignore property. Remove docs that has ignore property.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @private
    */
   _resolveIgnore(docDB, filePath)
   {
      const docs = docDB.find(filePath ? { ignore: true, filePath } : { ignore: true });

      for (const doc of docs)
      {
         const longname = doc.longname.replace(/[$]/g, '\\$');
         const regex = new RegExp(`^${longname}[.~#]`);

         docDB.query({ longname: { regex } }).remove();
      }

      docDB.query({ ignore: true }).remove();
   }

   /**
    * Resolve necessary identifiers.
    *
    * ```javascript
    * class Foo {}
    *
    * export default Bar extends Foo {}
    * ```
    *
    * ``Foo`` is not exported, but ``Bar`` extends ``Foo``.
    * ``Foo`` is necessary.
    * So, ``Foo`` must be exported by force.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @private
    */
   _resolveNecessary(docDB, filePath)
   {
      docDB.query(filePath ? { 'export': false, filePath } : { 'export': false }).update(function()
      {
         const doc = this;
         const childNames = [];

         if (doc._custom_direct_subclasses) { childNames.push(...doc._custom_direct_subclasses); }
         if (doc._custom_indirect_subclasses) { childNames.push(...doc._custom_indirect_subclasses); }
         if (doc._custom_direct_implemented) { childNames.push(...doc._custom_direct_implemented); }
         if (doc._custom_indirect_implemented) { childNames.push(...doc._custom_indirect_implemented); }

         for (const childName of childNames)
         {
            const childDoc = docDB.find({ longname: childName })[0];

            if (!childDoc) { continue; }

            if (!childDoc.ignore && childDoc.export)
            {
               doc.export = true;
               return doc;
            }
         }
      });
   }

   /**
    * Resolve tests and identifier relationships adding the following special properties:
    * - ``_custom_tests``: longnames of test doc.
    * - ``_custom_test_targets``: longnames of identifier.
    *
    * @private
    */
   _resolveTestRelation(docDB, filePath, silent)
   {
      /**
       * Tracks which docs need to initialize `_custom_<X>` lists.
       * @type {{}}
       */
      const seenData = {};

      /**
       * Stores data in `seenData` by doc.longname -> `_custom_<X>` list name tracking which docs need to initialize
       * `_custom_<X>` lists. This is necessary to reinitialize as resolving can occur multiple times across the
       * same data.
       *
       * @param {DocObject}   doc - DocObject to test.
       *
       * @param {string}      type - `_custom_<X>` list name.
       *
       * @returns {boolean} Result if whether the custom list name for the given doc object has already been seen.
       */
      const seen = (doc, type) =>
      {
         if (typeof seenData[doc.longname] !== 'object') { seenData[doc.longname] = {}; }

         const docData = seenData[doc.longname];

         const typeSeen = docData[type] || false;

         docData[type] = true;

         return typeSeen;
      };

      const testDocs = docDB.find(filePath ? { kind: 'Test', filePath } : { kind: 'Test' });

      if (!silent && testDocs.length > 0)
      {
         this._eventbus.trigger('log:info:raw', 'tjsdoc-doc-resolver-core: resolve test relation');
      }

      for (const testDoc of testDocs)
      {
         const testTargets = testDoc.testTargets;

         if (!testTargets) { continue; }

         for (const testTarget of testTargets)
         {
            const doc = docDB.findByName(testTarget)[0];

            if (doc)
            {
               if (!seen(doc, '_custom_tests')) { doc._custom_tests = []; }

               doc._custom_tests.push(testDoc.longname);

               if (!seen(testDoc, '_custom_test_targets')) { testDoc._custom_test_targets = []; }

               testDoc._custom_test_targets.push([doc.longname, testTarget]);
            }
            else
            {
               if (!seen(testDoc, '_custom_test_targets')) { testDoc._custom_test_targets = []; }

               testDoc._custom_test_targets.push([testTarget, testTarget]);
            }
         }
      }

      // test full description
      for (const testDoc of testDocs)
      {
         const desc = [];
         const parents = (testDoc.memberof.split('~')[1] || '').split('.');

         for (const parent of parents)
         {
            const doc = docDB.find({ kind: 'Test', name: parent })[0];

            if (!doc) { continue; }

            desc.push(doc.description);
         }

         desc.push(testDoc.description);
         testDoc.testFullDescription = desc.join(' ');
      }
   }

   /**
    * Resolve undocument identifier doc. The ignore property is added docs that have no documentation tags.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @private
    */
   _resolveUndocumentIdentifier(docDB, filePath)
   {
      if (!this._mainConfig.undocumentIdentifier)
      {
         docDB.query(filePath ? { undocument: true, filePath } : { undocument: true }).update({ ignore: true });
      }
   }

   /**
    * Resolve unexport identifier doc. The ignore property is added to non-exported docs.
    *
    * @param {DocDB}    docDB - The target DocDB to resolve.
    *
    * @param {boolean}  [filePath=undefined] - Defines a string or array of strings limiting resolution to the given
    *                                          file paths.
    *
    * @private
    */
   _resolveUnexportIdentifier(docDB, filePath)
   {
      if (!this._mainConfig.unexportIdentifier)
      {
         docDB.query(filePath ? { 'export': false, filePath } : { 'export': false }).update({ ignore: true });
      }
   }
}
