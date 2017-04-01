import DocBase from './DocBase.js';

/**
 * Provides the common base for documenting class methods.
 *
 * Child classes must implement the following methods:
 *
 * _$async()
 *
 * _$kind()
 *
 * _$generator()
 *
 * _$memberof()
 *
 * _$name()
 *
 * _$param()
 *
 * _$return()
 *
 * _$static()
 *
 * _$type()
 */
export default class ClassMethodDocBase extends DocBase
{
}
