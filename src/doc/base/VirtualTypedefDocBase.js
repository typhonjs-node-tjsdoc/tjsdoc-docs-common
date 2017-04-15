import DocBase from './DocBase.js';

/**
 * Provides the common base for virtual comment node `@typedef`.
 *
 * The following tags / annotations are supported by VirtualTypedefDocBase and children implementations:
 *
 * `@typedef`
 *
 * Child classes must implement the following methods:
 *
 * _$memberof()
 */
export default class VirtualTypedefDocBase extends DocBase
{
   /**
    * The following methods provide the @xxx tags / annotations supported in VirtualTypedefDocBase. Adding methods
    * makes it easy to detect any unknown tags when a method is missing. Child classes may also add the tags that they
    * support.
    */

   /** @ignore */ static _tag_typedef() {}

   /**
    * specify `VirtualTypedef` to category.
    */
   static _$category()
   {
      this._value.category = 'VirtualTypedef';
   }

   /** specify `VirtualTypedef` to kind. */
   static _$kind()
   {
      this._value.kind = 'VirtualTypedef';
   }

   /** set name by using tag. */
   static _$name()
   {
      const tags = this._findAll(['@typedef']);

      if (!tags)
      {
         this._eventbus.trigger('log:warn', 'can not resolve name.');
         return;
      }

      let name;

      for (const tag of tags)
      {
         name = this._eventbus.triggerSync('tjsdoc:system:parser:param:value:parse', tag.tagValue,
          { type: true, name: true, desc: false }).paramName;
      }

      this._value.name = name;
   }

   /** for @typedef */
   static _$typedef()
   {
      const value = this._findTagValue(['@typedef']);

      if (!value) { return; }

      const result = this._eventbus.triggerSync('tjsdoc:system:parser:param:parse', value,
       { type: true, name: true, desc: false });

      Reflect.deleteProperty(result, 'description');
      Reflect.deleteProperty(result, 'nullable');
      Reflect.deleteProperty(result, 'spread');

      this._value.type = result;
   }
}
