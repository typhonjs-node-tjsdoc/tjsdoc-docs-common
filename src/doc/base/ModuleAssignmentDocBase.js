import ModuleDocBase from './ModuleDocBase.js';

/**
 * Provides the common base for documenting variable assignment.
 *
 * Child classes must implement the following methods:
 *
 * _$name()
 */
export default class ModuleAssignmentDocBase extends ModuleDocBase
{
   /**
    * specify `ModuleVariable` to category.
    */
   static _$category()
   {
      this._value.category = 'ModuleVariable';
   }

   /**
    * specify `ModuleVariable` to kind.
    */
   static _$kind()
   {
      this._value.kind = 'ModuleAssignment';
   }

   /**
    * take out self memberof from file path.
    */
   static _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}

