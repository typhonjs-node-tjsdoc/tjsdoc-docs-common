import DocBase from './DocBase.js';

/**
 * Provides the common base for documenting class methods.
 *
 * Child classes must implement the following methods:
 *
 * _$accessor()
 *
 * _$async()
 *
 * _$category()
 *
 * _$generator()
 *
 * _$memberof()
 *
 * _$name()
 *
 * _$param()
 *
 * _$qualifier()
 *
 * _$return()
 *
 * _$static()
 *
 * _$type()
 */
export default class ClassMethodDocBase extends DocBase
{
   /** Set kind to 'ClassMethod'. */
   static _$kind()
   {
      this._value.kind = 'ClassMethod';
   }
}
