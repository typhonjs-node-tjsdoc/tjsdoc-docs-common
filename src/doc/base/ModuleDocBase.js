import DocBase from './DocBase.js';

/**
 * Contains methods required for doc types that need module import / export support.
 */
export default class ModuleDocBase extends DocBase
{
   /**
    * decide `export`.
    */
   static _$export()
   {
      this._value.export = this._eventbus.triggerSync('tjsdoc:system:ast:parent:export:find', this._node);
   }

   /**
    * decide `importPath`.
    */
   static _$importPath()
   {
      this._value.importPath = this._pathResolver.importPath;
   }

   /**
    * Decide `importStyle`.
    *
    * Note: Any changes here also need to be updated in DocGenerator `_processDefaultExport` & `_processNamedExport`.
    */
   static _$importStyle()
   {
      this._ensureApplied('_$name');

      // TODO REMOVE after final removal of old traversal algorithm from DocGenerator.
      if (this._node.__PseudoExport__)
      {
         this._value.importStyle = null;
         return;
      }

      // this._ensureApplied('_$name');

      this._value.importStyle = this._eventbus.triggerSync('tjsdoc:system:ast:import:style:find', this._node,
       this._value.name);
   }
}
