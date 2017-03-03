import AbstractDoc   from './AbstractDoc.js';

/**
 * Contains methods required for doc types that need module import / export support.
 */
export default class AbstractModuleDoc extends AbstractDoc
{
   /**
    * decide `export`.
    */
   _$export()
   {
      this._value.export = this._eventbus.triggerSync('tjsdoc:ast:find:parent:export', this._node);
   }

   /**
    * decide `importPath`.
    */
   _$importPath()
   {
      this._value.importPath = this._pathResolver.importPath;
   }

   /**
    * decide `importStyle`.
    */
   _$importStyle()
   {
      if (this._node.__PseudoExport__)
      {
         this._value.importStyle = null;
         return;
      }

      this._ensureApplied('_$name');

      this._value.importStyle = this._eventbus.triggerSync('tjsdoc:ast:find:import:style', this._node,
       this._value.name);
   }
}
