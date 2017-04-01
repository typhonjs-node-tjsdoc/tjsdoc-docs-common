import AbstractModuleDoc   from './AbstractModuleDoc.js';

/**
 * Provides the common base for documenting variable assignment.
 *
 * Child classes must implement the following methods:
 *
 * _$name()
 */
export default class AbstractAssignmentDoc extends AbstractModuleDoc
{
   /**
    * specify ``variable`` to kind.
    */
   static _$kind()
   {
      this._value.kind = 'variable';
   }

   /**
    * take out self memberof from file path.
    */
   static _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}

