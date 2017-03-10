import path from 'path';

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

      this._eventbus.on('tjsdoc:core:doc:resolver:resolve', this.resolve, this);
   }

   /**
    * Resolve various properties.
    */
   resolve()
   {
      const config = this._eventbus.triggerSync('tjsdoc:get:config', false);

      this._eventbus.trigger('log:info:raw', 'resolve: extends chain');
      this._resolveExtendsChain();

      this._eventbus.trigger('log:info:raw', 'resolve: necessary');
      this._resolveNecessary();

      this._eventbus.trigger('log:info:raw', 'resolve: access');
      this._resolveAccess();

      this._eventbus.trigger('log:info:raw', 'resolve: unexported identifier');
      this._resolveUnexportIdentifier();

      this._eventbus.trigger('log:info:raw', 'resolve: undocument identifier');
      this._resolveUndocumentIdentifier();

      this._eventbus.trigger('log:info:raw', 'resolve: duplication');
      this._resolveDuplication();

      this._eventbus.trigger('log:info:raw', 'resolve: ignore');
      this._resolveIgnore();

      if (config.removeCommonPath)
      {
         this._eventbus.trigger('log:info:raw', 'resolve: removing common path');
         this._resolveCommonPath(config);
      }
   }

   /**
    * Resolve access property. If doc does not have access property, the doc is public. but if the name starts with '_',
    * the doc is considered private if TJSDocConfig parameter `autoPrivate` is true.
    *
    * @private
    */
   _resolveAccess()
   {
      const config = this._eventbus.triggerSync('tjsdoc:get:config');

      const access = config.access || ['public', 'protected', 'private'];
      const autoPrivate = config.autoPrivate;

      this._eventbus.triggerSync('tjsdoc:docs:query').update(function()
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
    * @param {TJSDocConfig}   config - The TJSDoc config in write mode. _dirPath modified.
    *
    * @private
    */
   _resolveCommonPath(config)
   {
      const docs = this._eventbus.triggerSync('tjsdoc:docs:find', { kind: { '!is': 'memory' } },
       { kind: { '!is': 'external' } });

      if (docs.length === 0) { return; }

      let commonPath = this._eventbus.triggerSync('typhonjs:util:file:path:common:mapped', 'longname', ...docs);

      if (commonPath === '') { return; }

      // Must rewrite `_dirPath` with the removed common path otherwise resolving actual files will fail.
      config._dirPath = path.resolve(config._dirPath, commonPath);

      this._eventbus.trigger('log:info:raw', `common path removed: ${commonPath}`);
      this._eventbus.trigger('log:info:raw', `new config._dirPath: ${config._dirPath}`);

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
      const docs = this._eventbus.triggerSync('tjsdoc:docs:find', { kind: 'member' });
      const ignoreId = [];

      for (const doc of docs)
      {
         // member duplicate with getter/setter/method. when it, remove member. getter/setter/method are high priority.
         const nonMemberDup = this._eventbus.triggerSync('tjsdoc:docs:find',
          { longname: doc.longname, kind: { '!is': 'member' } });

         if (nonMemberDup.length)
         {
            ignoreId.push(doc.___id);
            continue;
         }

         const dup = this._eventbus.triggerSync('tjsdoc:docs:find', { longname: doc.longname, kind: 'member' });

         if (dup.length > 1)
         {
            const ids = dup.map((v) => v.___id);

            ids.sort((a, b) => { return a < b ? -1 : 1; });
            ids.shift();

            ignoreId.push(...ids);
         }
      }

      this._eventbus.triggerSync('tjsdoc:docs:query', { ___id: ignoreId }).update(function()
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
      const extendsChain = (doc) =>
      {
         if (!doc.extends) { return; }

         const selfDoc = doc;

         // traverse super class.
         const chains = [];

         do
         {
            const superClassDoc = this._eventbus.triggerSync('tjsdoc:docs:find:by:name', doc.extends[0])[0];

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
            let superClassDoc = this._eventbus.triggerSync('tjsdoc:docs:find:by:name', chains[0])[0];

            if (superClassDoc)
            {
               if (!superClassDoc._custom_direct_subclasses) { superClassDoc._custom_direct_subclasses = []; }

               superClassDoc._custom_direct_subclasses.push(selfDoc.longname);
            }

            // indirect subclass
            for (const superClassLongname of chains.slice(1))
            {
               superClassDoc = this._eventbus.triggerSync('tjsdoc:docs:find:by:name', superClassLongname)[0];

               if (superClassDoc)
               {
                  if (!superClassDoc._custom_indirect_subclasses) { superClassDoc._custom_indirect_subclasses = []; }

                  superClassDoc._custom_indirect_subclasses.push(selfDoc.longname);
               }
            }

            // indirect implements and mixes
            for (const superClassLongname of chains)
            {
               superClassDoc = this._eventbus.triggerSync('tjsdoc:docs:find:by:name', superClassLongname)[0];

               if (!superClassDoc) { continue; }

               // indirect implements
               if (superClassDoc.implements)
               {
                  if (!selfDoc._custom_indirect_implements) { selfDoc._custom_indirect_implements = []; }

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
            const superClassDoc = this._eventbus.triggerSync('tjsdoc:docs:find:by:name', superClassLongname)[0];

            if (!superClassDoc) { continue; }
            if (!superClassDoc._custom_direct_implemented) { superClassDoc._custom_direct_implemented = []; }

            superClassDoc._custom_direct_implemented.push(selfDoc.longname);
         }

         // indirect implemented (like indirect subclass)
         for (const superClassLongname of selfDoc._custom_indirect_implements || [])
         {
            const superClassDoc = this._eventbus.triggerSync('tjsdoc:docs:find:by:name', superClassLongname)[0];

            if (!superClassDoc) { continue; }
            if (!superClassDoc._custom_indirect_implemented) { superClassDoc._custom_indirect_implemented = []; }

            superClassDoc._custom_indirect_implemented.push(selfDoc.longname);
         }
      };

      const docs = this._eventbus.triggerSync('tjsdoc:docs:find', { kind: 'class' });

      for (const doc of docs)
      {
         extendsChain(doc);
         implemented(doc);
      }
   }

   /**
    * Resolve ignore property. Remove docs that has ignore property.
    *
    * @private
    */
   _resolveIgnore()
   {
      const docs = this._eventbus.triggerSync('tjsdoc:docs:find', { ignore: true });

      for (const doc of docs)
      {
         const longname = doc.longname.replace(/[$]/g, '\\$');
         const regex = new RegExp(`^${longname}[.~#]`);

         this._eventbus.triggerSync('tjsdoc:docs:query', { longname: { regex } }).remove();
      }

      this._eventbus.triggerSync('tjsdoc:docs:query', { ignore: true }).remove();
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
      const eventbus = this._eventbus;

      eventbus.triggerSync('tjsdoc:docs:query', { 'export': false }).update(function()
      {
         const doc = this;
         const childNames = [];

         if (doc._custom_direct_subclasses) { childNames.push(...doc._custom_direct_subclasses); }
         if (doc._custom_indirect_subclasses) { childNames.push(...doc._custom_indirect_subclasses); }
         if (doc._custom_direct_implemented) { childNames.push(...doc._custom_direct_implemented); }
         if (doc._custom_indirect_implemented) { childNames.push(...doc._custom_indirect_implemented); }

         for (const childName of childNames)
         {
            const childDoc = eventbus.triggerSync('tjsdoc:docs:find', { longname: childName })[0];

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
      const config = this._eventbus.triggerSync('tjsdoc:get:config');

      if (!config.undocumentIdentifier)
      {
         this._eventbus.triggerSync('tjsdoc:docs:query', { undocument: true }).update({ ignore: true });
      }
   }

   /**
    * Resolve unexport identifier doc. The ignore property is added to non-exported docs.
    *
    * @private
    */
   _resolveUnexportIdentifier()
   {
      const config = this._eventbus.triggerSync('tjsdoc:get:config');

      if (!config.unexportIdentifier)
      {
         this._eventbus.triggerSync('tjsdoc:docs:query', { 'export': false }).update({ ignore: true });
      }
   }
}
