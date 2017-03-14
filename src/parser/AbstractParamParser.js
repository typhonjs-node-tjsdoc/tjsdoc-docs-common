/**
 * Abstract Param Type Parser class - Provides the common param parsing functionality with a child implementation
 * providing the AST specific guessing of param types.
 */
export default class AbstractParamParser
{
   /**
    * guess param type by using param default arguments.
    *
    * @param {Object} params - node of callable AST node.
    *
    * @abstract
    * @returns {ParsedParam[]} guess param results.
    */
   guessParams(params)  // eslint-disable-line no-unused-vars
   {
      throw new Error('An AST / parser specific implementation must be provided by a child class.');
   }

   /**
    * guess return type by using return node.
    *
    * @param {ASTNode} body - callable body node.
    *
    * @abstract
    * @returns {ParsedParam|null}
    */
   guessReturnParam(body)  // eslint-disable-line no-unused-vars
   {
      throw new Error('An AST / parser specific implementation must be provided by a child class.');
   }

   /**
    * guess self type by using assignment node.
    *
    * @param {ASTNode} right - assignment right node.
    *
    * @abstract
    * @returns {ParsedParam}
    */
   guessType(right)  // eslint-disable-line no-unused-vars
   {
      throw new Error('An AST / parser specific implementation must be provided by a child class.');
   }

   /**
    * Wires up ParamParser on the plugin eventbus and stores it in a local module scope variable.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      /**
       * Stores the plugin eventbus proxy.
       * @type {EventProxy}
       */
      this._eventbus = ev.eventbus;

      this._eventbus.on('tjsdoc:system:parser:param:guess', this.guessParams, this);
      this._eventbus.on('tjsdoc:system:parser:param:return:guess', this.guessReturnParam, this);
      this._eventbus.on('tjsdoc:system:parser:param:type:guess', this.guessType, this);
      this._eventbus.on('tjsdoc:system:parser:param:parse', this.parseParam, this);
      this._eventbus.on('tjsdoc:system:parser:param:from:value:parse', this.parseParamFromValue, this);
      this._eventbus.on('tjsdoc:system:parser:param:value:parse', this.parseParamValue, this);
   }

   /**
    * Parses a param value and builds a formatted result.
    *
    * @param {string} value - param value.
    *
    * @param {object} options - param value.
    * @property {boolean} [type=true] if true, contain param type.
    * @property {boolean} [name=true] if true, contain param name.
    * @property {boolean} [desc=true] if true, contain param description.
    *
    * @returns {ParsedParam}
    */
   parseParam(value, options = { type: true, name: true, desc: true })
   {
      return this.parseParamFromValue(this.parseParamValue(value, options));
   }

   /**
    * Parses param text and build formatted result.
    *
    * @param {object} options - param value.
    * @property {string} typeText - param type text.
    * @property {string} [paramName] - param name.
    * @property {string} [paramDesc] - param description.
    *
    * @example
    * const value = '{number} param - this is number param';
    * const {typeText, paramName, paramDesc} = ParamParser.parseParamValue(value);
    *
    * @example
    * const result = ParamParser.parseParamFromValue(ParamParser.parseParamValue(value));
    *
    * Please see ParamParser.parseParam for a method which combines the above into one call.
    *
    * @returns {ParsedParam} formatted result.
    */
   parseParamFromValue(options = { typeText: void 0 })
   {
      const result = {};

      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'.`); }
      if (typeof options.typeText !== 'string') { throw new TypeError(`'options.typeText' is not a 'string'.`); }

      if (options.paramName && typeof options.paramName !== 'string')
      {
         throw new TypeError(`'options.paramName' is not a 'string'.`);
      }

      if (options.paramDesc && typeof options.paramDesc !== 'string')
      {
         throw new TypeError(`'options.paramDesc' is not a 'string'.`);
      }

      const { paramDesc } = options;
      let { typeText, paramName } = options;

      if (typeText)
      {
         // check nullable
         if (typeText[0] === '?')
         {
            result.nullable = true;
         }
         else if (typeText[0] === '!')
         {
            result.nullable = false;
         }
         else
         {
            result.nullable = null;
         }

         typeText = typeText.replace(/^[?!]/, '');

         // check record and union
         if (typeText[0] === '{')
         {
            result.types = [typeText];
         }
         else if (typeText[0] === '(')
         {
            typeText = typeText.replace(/^[(]/, '').replace(/[)]$/, '');
            result.types = typeText.split('|');
         }
         else if (typeText.includes('|'))
         {
            if (typeText.match(/<.*?\|.*?>/))
            {
               // union in generics. e.g. `Array<string|number>`
               // hack: in this case, process this type in DocBuilder#_buildTypeDocLinkHTML
               result.types = [typeText];
            }
            else if (typeText.match(/^\.\.\.\(.*?\)/))
            {
               // union with spread. e.g. `...(string|number)`
               // hack: in this case, process this type in DocBuilder#_buildTypeDocLinkHTML
               result.types = [typeText];
            }
            else
            {
               result.types = typeText.split('|');
            }
         }
         else
         {
            result.types = [typeText];
         }

         result.spread = typeText.indexOf('...') === 0;
      }
      else
      {
         result.types = [''];
      }

      if (result.types.some((t) => !t))
      {
         throw new Error(`Empty Type found name=${paramName} desc=${paramDesc}`);
      }

      if (paramName)
      {
         // check optional
         if (paramName[0] === '[')
         {
            result.optional = true;

            paramName = paramName.replace(/^[\[]/, '').replace(/[\]]$/, '');
         }
         else
         {
            result.optional = false;
         }

         // check default value
         const pair = paramName.split('=');

         if (pair.length === 2)
         {
            result.defaultValue = pair[1];

            try
            {
               result.defaultRaw = JSON.parse(pair[1]);
            }
            catch (err)
            {
               result.defaultRaw = pair[1];
            }
         }

         result.name = pair[0].trim();
      }

      result.description = paramDesc;

      return result;
   }

   /**
    * parse param value.
    *
    * @param {string} value - param value.
    *
    * @param {object} options - param value.
    * @property {boolean} [type=true] if true, contain param type.
    * @property {boolean} [name=true] if true, contain param name.
    * @property {boolean} [desc=true] if true, contain param description.
    *
    * @example
    * let value = '{number} param - this is number param';
    * let {typeText, paramName, paramDesc} = ParamParser.parseParamValue(value);
    *
    * let value = '{number} this is number return value';
    * let {typeText, paramDesc} = ParamParser.parseParamValue(value, { type: true, name: false, desc: true });
    *
    * let value = '{number}';
    * let {typeText} = ParamParser.parseParamValue(value, { type: true, name: false, desc: false });
    *
    * @return {{typeText: string, paramName: string, paramDesc: string}} parsed value.
    */
   parseParamValue(value, options = { type: true, name: true, desc: true })
   {
      if (typeof options !== 'object') { throw new TypeError(`'options' is not an 'object'.`); }

      if (options.type && typeof options.type !== 'boolean')
      {
         throw new TypeError(`'options.type' is not a 'boolean'.`);
      }

      if (options.name && typeof options.name !== 'boolean')
      {
         throw new TypeError(`'options.name' is not a 'boolean'.`);
      }

      if (options.desc && typeof options.desc !== 'boolean')
      {
         throw new TypeError(`'options.desc' is not a 'boolean'.`);
      }

      value = value.trim();

      let match, paramDesc, paramName, typeText;

      // e.g {number}
      if (options.type)
      {
         const reg = /^\{([^@]*?)\}(\s+|$)/; // ``@`` is special char in ``{@link foo}``

         match = value.match(reg);

         if (match)
         {
            typeText = match[1];
            value = value.replace(reg, '');
         }
         else
         {
            typeText = '*';
         }
      }

      // e.g. [p1=123]
      if (options.name)
      {
         if (value.charAt(0) === '[')
         {
            paramName = '';
            let counter = 0;

            for (const c of value)
            {
               paramName += c;

               if (c === '[') { counter++; }
               if (c === ']') { counter--; }
               if (counter === 0) { break; }
            }

            if (paramName)
            {
               value = value.substr(paramName.length).trim();
            }
         }
         else
         {
            match = value.match(/^(\S+)/);

            if (match)
            {
               paramName = match[1];
               value = value.replace(/^\S+\s*/, '');
            }
         }
      }

      // e.g. this is p1 desc.
      if (options.desc)
      {
         match = value.match(/^\-?\s*((:?.|\n)*)$/m);

         if (match)
         {
            paramDesc = match[1];
         }
      }

      if (options.type && typeof typeText === 'undefined')
      {
         throw new TypeError(`param is invalid. param = "${value}"`);
      }

      if (options.name && typeof paramName === 'undefined')
      {
         throw new TypeError(`param is invalid. param = "${value}"`);
      }

      if (options.desc && typeof paramDesc === 'undefined')
      {
         throw new TypeError(`param is invalid. param = "${value}"`);
      }

      return { typeText, paramName, paramDesc };
   }
}
