import ModuleFileDoc from './ModuleFileDoc.js';

/**
 * Doc class for test code file.
 */
export default class ModuleTestFileDoc extends ModuleFileDoc
{
   /** set ``testFile`` to kind. */
   static _$kind()
   {
      this._value.kind = 'testFile';
   }
}
