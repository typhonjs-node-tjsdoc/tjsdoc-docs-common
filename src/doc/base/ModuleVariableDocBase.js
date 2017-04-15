import ModuleDocBase from './ModuleDocBase.js';

/**
 * Provides the common base for documenting variable declarations.
 *
 * Child classes must implement the following methods:
 *
 * _$name()
 */
export default class ModuleVariableDocBase extends ModuleDocBase
{
   /**
    * specify `ModuleVariable` to category.
    */
   static _$category()
   {
      this._value.category = 'ModuleVariable';
   }

   /** specify ``variable`` to kind. */
   static _$kind()
   {
      this._value.kind = 'ModuleVariable';
   }

   /** set memberof by using file path. */
   static _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}
