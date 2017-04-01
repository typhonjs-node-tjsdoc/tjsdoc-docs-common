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
      this._config = ev.data.config;

      this._mainDocDB = this._eventbus.triggerSync('tjsdoc:data:docdb:get');
   }

   /**
    * Resolve various properties.
    *
    * @param {boolean}  [log=true] - If true then logging is output for each resolution stage.
    *
    * @param {boolean}  [reset=false] - If true then all existing custom resolver data is removed prior to resolution.
    */
   resolve({ log = true, query = void 0, reset = false } = {})
   {
      // TODO: consider if resetting is valid
      // Potentially reset resolver data.
      // if (reset) { this._eventbus.triggerSync('tjsdoc:data:docdb:query').each((doc => delete doc._resolver); }

      // Must remove common path first as `longname`, `memberof, and `name` are modified.
      if (this._config.removeCommonPath)
      {
         if (log) { this._eventbus.trigger('log:info:raw', 'resolve: removing common path'); }
         this._resolveCommonPath();
      }

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: extends chain'); }
      this._resolveExtendsChain();

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: necessary'); }
      this._resolveNecessary();

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: access'); }
      this._resolveAccess();

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: unexported identifier'); }
      this._resolveUnexportIdentifier();

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: undocument identifier'); }
      this._resolveUndocumentIdentifier();

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: duplication'); }
      this._resolveDuplication();

      if (log) { this._eventbus.trigger('log:info:raw', 'resolve: ignore'); }
      this._resolveIgnore();
   }

   /**
    * Resolve access property. If doc does not have access property, the doc is public. but if the name starts with '_',
    * the doc is considered private if TJSDocConfig parameter `autoPrivate` is true.
    *
    * @private
    */
   _resolveAccess()
   {
      const access = this._config.access || ['public', 'protected', 'private'];
      const autoPrivate = this._config.autoPrivate;

      this._mainDocDB.query().update(function()
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
    * @private
    */
   _resolveCommonPath()
   {
      const docs = this._mainDocDB.find({ kind: { '!is': 'memory' } },
       { kind: { '!is': 'external' } });

      if (docs.length === 0) { return; }

      let commonPath = this._eventbus.triggerSync('typhonjs:util:file:path:common:mapped', 'filePath', ...docs);

      if (commonPath === '') { return; }

      this._eventbus.trigger('log:info:raw', `common path removed: ${commonPath}`);

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
    * @private
    */
   _resolveDuplication()
   {
      const docs = this._mainDocDB.find({ kind: 'member' });
      const ignoreId = [];

      for (const doc of docs)
      {
         // member duplicate with getter/setter/method. when it, remove member. getter/setter/method are high priority.
         const nonMemberDup = this._mainDocDB.find({ longname: doc.longname, kind: { '!is': 'member' } });

         if (nonMemberDup.length)
         {
            ignoreId.push(doc.___id);
            continue;
         }

         const dup = this._mainDocDB.find({ longname: doc.longname, kind: 'member' });

         if (dup.length > 1)
         {
            const ids = dup.map((v) => v.___id);

            ids.sort((a, b) => { return a < b ? -1 : 1; });
            ids.shift();

            ignoreId.push(...ids);
         }
      }

      this._mainDocDB.query({ ___id: ignoreId }).update(function()
      {
         this.ignore = true;

         return this;
      });
   }

   /**
    * Resolve class extends chain.
    *
    * Add following special properties:
    * - ``_custom_extends_chain``: ancestor class chain.
    * - ``_custom_direct_subclasses``: class list that directly extends target doc.
    * - ``_custom_indirect_subclasses``: class list that indirectly extends target doc.
    * - ``_custom_indirect_implements``: class list that indirectly implements target doc.
    * - ``_custom_direct_implemented``: class list that directly implements target doc.
    * - ``_custom_indirect_implemented``: class list that indirectly implements target doc.
    *
    * @private
    */
   _resolveExtendsChain()
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

         do
         {
            const superClassDoc = this._mainDocDB.findByName(doc.extends[0])[0];

            if (superClassDoc)
            {
               // this is circular extends
               if (superClassDoc.longname === selfDoc.longname) { break; }

               chains.push(superClassDoc.longname);

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
            let superClassDoc = this._mainDocDB.findByName(chains[0])[0];

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
               superClassDoc = this._mainDocDB.findByName(superClassLongname)[0];

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
               superClassDoc = this._mainDocDB.findByName(superClassLongname)[0];

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
            const superClassDoc = this._mainDocDB.findByName(superClassLongname)[0];

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
            const superClassDoc = this._mainDocDB.findByName(superClassLongname)[0];

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

      const docs = this._mainDocDB.find({ kind: 'class' });

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
            const fileDoc = this._mainDocDB.find({ kind: 'file', filePath: doc.filePath })[0];

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
    * @private
    */
   _resolveIgnore()
   {
      const docs = this._mainDocDB.find({ ignore: true });

      for (const doc of docs)
      {
         const longname = doc.longname.replace(/[$]/g, '\\$');
         const regex = new RegExp(`^${longname}[.~#]`);

         this._mainDocDB.query({ longname: { regex } }).remove();
      }

      this._mainDocDB.query({ ignore: true }).remove();
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
    * @private
    */
   _resolveNecessary()
   {
      const mainDocDB = this._mainDocDB;

      mainDocDB.query({ 'export': false }).update(function()
      {
         const doc = this;
         const childNames = [];

         if (doc._custom_direct_subclasses) { childNames.push(...doc._custom_direct_subclasses); }
         if (doc._custom_indirect_subclasses) { childNames.push(...doc._custom_indirect_subclasses); }
         if (doc._custom_direct_implemented) { childNames.push(...doc._custom_direct_implemented); }
         if (doc._custom_indirect_implemented) { childNames.push(...doc._custom_indirect_implemented); }

         for (const childName of childNames)
         {
            const childDoc = mainDocDB.find({ longname: childName })[0];

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
    * Resolve undocument identifier doc. The ignore property is added docs that have no documentation tags.
    *
    * @private
    */
   _resolveUndocumentIdentifier()
   {
      if (!this._config.undocumentIdentifier)
      {
         this._mainDocDB.query({ undocument: true }).update({ ignore: true });
      }
   }

   /**
    * Resolve unexport identifier doc. The ignore property is added to non-exported docs.
    *
    * @private
    */
   _resolveUnexportIdentifier()
   {
      if (!this._config.unexportIdentifier)
      {
         this._mainDocDB.query({ 'export': false }).update({ ignore: true });
      }
   }
}
