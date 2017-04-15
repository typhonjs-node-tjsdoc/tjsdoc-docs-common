import ModuleDocBase   from './ModuleDocBase.js';

/**
 * Provides the common base for documenting functions (module scope).
 *
 * Child classes must implement the following methods:
 *
 * _$async()
 *
 * _$generator()
 *
 * _$param()
 *
 * _$name()
 *
 * _$return()
 */
export default class ModuleFunctionDocBase extends ModuleDocBase
{
   /**
    * specify `ModuleFunction` to category.
    */
   static _$category()
   {
      this._value.category = 'ModuleFunction';
   }

   /** specify ``function`` to kind. */
   static _$kind()
   {
      this._value.kind = 'function';
   }

   /** take out self name from file path */
   static _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}
