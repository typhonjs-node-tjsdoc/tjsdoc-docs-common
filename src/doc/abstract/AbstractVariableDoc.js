import AbstractModuleDoc   from './AbstractModuleDoc.js';

/**
 * Provides the common base for documenting variable declarations.
 *
 * Child classes must implement the following methods:
 *
 * _$name()
 */
export default class AbstractVariableDoc extends AbstractModuleDoc
{
   /** specify ``variable`` to kind. */
   static _$kind()
   {
      this._value.kind = 'variable';
   }

   /** set memberof by using file path. */
   static _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}
