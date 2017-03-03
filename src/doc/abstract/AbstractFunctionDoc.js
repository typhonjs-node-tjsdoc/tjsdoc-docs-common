import AbstractModuleDoc   from './AbstractModuleDoc.js';

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
export default class AbstractFunctionDoc extends AbstractModuleDoc
{
   /** specify ``function`` to kind. */
   _$kind()
   {
      this._value.kind = 'function';
   }

   /** take out self name from file path */
   _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}
