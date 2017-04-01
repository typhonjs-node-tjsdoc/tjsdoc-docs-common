import fs      from 'fs';

import DocBase from './base/DocBase.js';

/**
 * Doc Class from source file.
 */
export default class FileDoc extends DocBase
{
   /**
    * Create doc data statically held. File docs are the module, so pass `null` as the module ID to DocBase.
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
    * @returns {FileDoc}
    */
   static create(docID, ast, node, pathResolver, commentTags = [], eventbus)
   {
      return super.create(docID, null, ast, node, pathResolver, commentTags, eventbus);
   }

   /** specify file content to value.content */
   static _$content()
   {
      const filePath = this._pathResolver.absolutePath;

      this._value.content = fs.readFileSync(filePath, { encode: 'utf8' }).toString();
   }

   /** specify ``file`` to kind. */
   static _$kind()
   {
      this._value.kind = 'file';
   }

   /** specify name to longname */
   static _$longname()
   {
      this._value.longname = this._pathResolver.filePath;
   }

   /** take out self name from file path */
   static _$name()
   {
      this._value.name = this._pathResolver.filePath;
   }
}
