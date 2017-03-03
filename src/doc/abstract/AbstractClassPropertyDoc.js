import AbstractDoc   from './AbstractDoc.js';

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
export default class AbstractClassPropertyDoc extends AbstractDoc
{
   /** specify ``member`` to kind. */
   _$kind()
   {
      this._value.kind = 'member';
   }
}
