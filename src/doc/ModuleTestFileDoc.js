import ModuleFileDoc from './ModuleFileDoc.js';

/**
 * Doc class for test code file.
 */
export default class ModuleTestFileDoc extends ModuleFileDoc
{
   /**
    * specify `ModuleTestFile` to category.
    */
   static _$category()
   {
      this._value.category = 'ModuleTestFile';
   }

   /** set ``testFile`` to kind. */
   static _$kind()
   {
      this._value.kind = 'testFile';
   }
}
