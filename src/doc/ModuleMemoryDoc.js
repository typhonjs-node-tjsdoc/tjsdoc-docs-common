import DocBase from './base/DocBase.js';

/**
 * Doc from source code in memory. (Used for dynamically loading virtual external & typedef types).
 */
export default class ModuleMemoryDoc extends DocBase
{
   /**
    * Create doc data statically held. Memory docs are the module, so pass `null` as the module ID to DocBase.
    *
    * @param {number}         docID - The docID for this doc.
    *
    * @param {AST}            ast - this is AST that contains this doc.
    *
    * @param {ASTNode}        node - this is self node.
    *
    * @param {PathResolver}   pathResolver - this is file path resolver that contains this doc.
    *
    * @param {Tag[]}          commentTags - this is tags that self node has.
    *
    * @param {EventProxy}     eventbus - An event proxy for the main eventbus.
    *
    * @param {String}         code - this is the in memory code that defines this doc.
    *
    * @returns {FileDoc}
    */
   static create(docID, ast, node, pathResolver, commentTags = [], eventbus, code)
   {
      super.create(docID, null, ast, node, pathResolver, commentTags, eventbus);

      // Must set content directly as all value properties are resolved in DocBase create.
      this._value.content = code;

      return this;
   }

   /**
    * specify `ModuleMemory` to category.
    */
   static _$category()
   {
      this._value.category = 'ModuleMemory';
   }

   /** specify ``memory`` to kind. */
   static _$kind()
   {
      this._value.kind = 'memory';
   }

   /** specify name to longname */
   static _$longname()
   {
      this._value.longname = 'In memory code';
   }

   /** take out self name from file path */
   static _$name()
   {
      this._value.name = 'In memory code';
   }
}
