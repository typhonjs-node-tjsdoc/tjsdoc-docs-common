import DocBase from './base/DocBase.js';

/**
 * Doc Class from virtual comment node of external.
 *
 * The following tags / annotations are supported by ExternalDoc and children implementations:
 *
 * `@external`
 */
export default class VirtualExternalDoc extends DocBase
{
   /**
    * The following methods provide the @xxx tags / annotations supported in ExternalDoc. Adding methods makes it easy
    * to detect any unknown tags when a method is missing. Child classes may also add the tags that they support.
    */

   /** @ignore */ static _tag_external() {}

   /** specify ``external`` to kind. */
   static _$kind()
   {
      this._value.kind = 'external';
   }

   /** specify name to longname */
   static _$longname()
   {
      super._$longname();

      if (this._value.longname) { return; }

      this._ensureApplied('_$name');

      this._value.longname = this._value.name;
   }

   /** take out self memberof from file path. */
   static _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }

   /** take out self name from tag */
   static _$name()
   {
      const value = this._findTagValue(['@external']);

      if (!value)
      {
         this._eventbus.trigger('log:warn', 'can not resolve name.');
      }

      this._value.name = value;

      const tags = this._findAll(['@external']);

      if (!tags)
      {
         this._eventbus.trigger('log:warn', 'can not resolve name.');
         return;
      }

      let name;

      for (const tag of tags)
      {
         const { typeText, paramDesc } = this._eventbus.triggerSync('tjsdoc:system:parser:param:value:parse',
          tag.tagValue, { type: true, name: false, desc: true });

         name = typeText;

         this._value.externalLink = paramDesc;
      }

      this._value.name = name;
   }
}

