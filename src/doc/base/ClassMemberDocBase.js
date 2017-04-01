import DocBase from './DocBase.js';

/**
 * Provides the common base for documenting member expressions.
 *
 * Child classes must implement the following methods:
 *
 * _$memberof()
 *
 * _$name()
 *
 * _$static()
 *
 * _$type()
 */
export default class ClassMemberDocBase extends DocBase
{
   /** specify ``member`` to kind. */
   static _$kind()
   {
      this._value.kind = 'member';
   }
}
