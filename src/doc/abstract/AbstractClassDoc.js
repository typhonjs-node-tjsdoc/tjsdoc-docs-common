import fs                  from 'fs';

import AbstractModuleDoc   from './AbstractModuleDoc.js';

/**
 * Provides the common base for documenting classes.
 *
 * The following tags / annotations are supported by AbstractClassDoc and children implementations:
 *
 * `@extends`, `@implements`, `@interface`
 *
 * Child classes must implement the following methods:
 *
 * _$name()
 *
 * _$extends()
 */
export default class AbstractClassDoc extends AbstractModuleDoc
{
   /**
    * read selection text in file.
    *
    * @param {string} filePath - target file full path.
    * @param {number} line - line number (one origin).
    * @param {number} startColumn - start column number (one origin).
    * @param {number} endColumn - end column number (one origin).
    * @returns {string} selection text
    * @private
    */
   _readSelection(filePath, line, startColumn, endColumn)
   {
      const code = fs.readFileSync(filePath).toString();
      const lines = code.split('\n');
      const selectionLine = lines[line - 1];
      const tmp = [];

      for (let i = startColumn; i < endColumn; i++)
      {
         tmp.push(selectionLine.charAt(i));
      }

      return tmp.join('');
   }

   /**
    * The following methods provide the @xxx tags / annotations supported in AbstractClassDoc. Adding methods makes it
    * easy to detect any unknown tags when a method is missing. Child classes may also add the tags that they support.
    */

   /** @ignore */ _tag_extend() {}
   /** @ignore */ _tag_extends() {}
   /** @ignore */ _tag_implement() {}
   /** @ignore */ _tag_implements() {}
   /** @ignore */ _tag_interface() {}

   /** for @implements */
   _$implements()
   {
      const values = this._findAllTagValues(['@implements']);

      if (!values) { return; }

      this._value.implements = [];

      for (const value of values)
      {
         const { typeText } = this._eventbus.triggerSync('tjsdoc:system:parser:param:value:parse', value,
          { type: true, name: false, desc: false });

         this._value.implements.push(typeText);
      }
   }

   /** for @interface */
   _$interface()
   {
      const tag = this._find(['@interface']);

      if (tag)
      {
         switch (tag.tagValue)
         {
            case '':
            case 'true':
            case true:
               this._value.interface = true;
               break;
         }
      }
      else
      {
         this._value.interface = false;
      }
   }

   /** specify ``class`` to kind. */
   _$kind()
   {
      this._value.kind = 'class';
   }

   /** take out self memberof from file path. */
   _$memberof()
   {
      this._value.memberof = this._pathResolver.filePath;
   }
}
