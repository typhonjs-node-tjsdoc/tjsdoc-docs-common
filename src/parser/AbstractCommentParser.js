/**
 * Doc Comment Parser class providing the common comment parsing logic.
 */
export default class AbstractCommentParser
{
   /**
    * Returns the value of the comment node.
    *
    * @param {ASTNode} commentNode - An AST node with potential comment block.
    *
    * @abstract
    * @returns {string|undefined} If node is a valid comment node return the value of the node or undefined.
    */
   getCommentValue(commentNode)  // eslint-disable-line no-unused-vars
   {
      throw new Error('An AST / parser specific implementation must be provided by a child class.');
   }

   /**
    * Wires up CommentParser on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      eventbus.on('tjsdoc:system:parser:comment:node:value:get', this.getCommentValue, this);
      eventbus.on('tjsdoc:system:parser:comment:parse', this.parse, this);
   }

   /**
    * parse comment to tags.
    *
    * @param {ASTNode}  commentNode - comment node.
    * @param {string}   commentNode.value - comment body.
    * @param {string}   commentNode.type - CommentBlock or CommentLine.
    *
    * @returns {Tag[]} parsed comment.
    */
   parse(commentNode)
   {
      let comment = this.getCommentValue(commentNode);

      if (comment === void 0) { return []; }

      // TODO: refactor
      comment = comment.replace(/\r\n/gm, '\n');      // for windows

      comment = comment.replace(/^[\t ]*/gm, '');     // remove line head space

      comment = comment.replace(/^\*[\t ]?/, '');     // remove first '*'

      comment = comment.replace(/[\t ]$/, '');        // remove last space

      comment = comment.replace(/^\*[\t ]?/gm, '');   // remove line head '*'

      if (comment.charAt(0) !== '@') { comment = `@desc ${comment}`; }  // auto insert @desc

      comment = comment.replace(/[\t ]*$/, '');       // remove tail space.

      comment = comment.replace(/^[\t ]*(@\w+)$/gm, '$1 \\TRUE'); // auto insert tag text to non-text tag (e.g. @interface)

      comment = comment.replace(/^[\t ]*(@\w+)[\t ](.*)/gm, '\\Z$1\\Z$2'); // insert separator (\\Z@tag\\Ztext)

      const lines = comment.split('\\Z');

      let tagName = '';
      let tagValue = '';
      const tags = [];

      for (let i = 0; i < lines.length; i++)
      {
         const line = lines[i];

         if (line.charAt(0) === '@')
         {
            tagName = line;
            const nextLine = lines[i + 1];

            if (nextLine.charAt(0) === '@')
            {
               tagValue = '';
            }
            else
            {
               tagValue = nextLine;
               i++;
            }

            tagValue = tagValue.replace('\\TRUE', '').replace(/^\n/, '').replace(/\n*$/, '');
            tags.push({ tagName, tagValue });
         }
      }
      return tags;
   }
}
