import DocBase from './DocBase.js';

/**
 * Provides the common base for documenting class properties.
 *
 * Child classes must implement the following methods:
 *
 * _$name()
 *
 * _$memberof()
 *
 * _$static()
 *
 * _$type()
 */
export default class ClassPropertyDocBase extends DocBase
{
   /** specify ``member`` to kind. */
   static _$kind()
   {
      this._value.kind = 'member';
   }
}
