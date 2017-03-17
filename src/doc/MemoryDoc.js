import AbstractDoc from './abstract/AbstractDoc.js';

/**
 * Doc from source code in memory. (Used for dynamically loading virtual external & typedef types).
 */
export default class MemoryDoc extends AbstractDoc
{
   /**
    * Create instance. Memory docs are the module, so pass `null` as the module ID to AbstractDoc.
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
    */
   constructor(docID, ast, node, pathResolver, commentTags = [], eventbus, code)
   {
      super(docID, null, ast, node, pathResolver, commentTags, eventbus);

      // Must set content directly as all value properties are resolved in AbstractDoc constructor.
      this._value.content = code;
   }

   /** specify ``memory`` to kind. */
   _$kind()
   {
      this._value.kind = 'memory';
   }

   /** specify name to longname */
   _$longname()
   {
      this._value.longname = 'In memory code';
   }

   /** take out self name from file path */
   _$name()
   {
      this._value.name = 'In memory code';
   }
}
