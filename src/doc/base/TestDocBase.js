import DocBase from './DocBase.js';

/**
 * Provides the common base for documenting tests.
 *
 * The following tags / annotations are supported by TestDocBase and children implementations:
 *
 * `@test`, `@testTarget`
 *
 * Child classes must implement the following methods:
 *
 * _$desc()
 *
 * _$kind()
 *
 * _$memberof()
 */
export default class TestDocBase extends DocBase
{

   /**
    * The following methods provide the @xxx tags / annotations supported in TestDocBase. Adding methods makes it
    * easy to detect any unknown tags when a method is missing. Child classes may also add the tags that they support.
    */

   /** @ignore */ static _tag_test() {}
   /** @ignore */ static _tag_testTarget() {}

   /** set name and testId from special tjsdoc property. */
   static _$name()
   {
      this._value.name = this._node._tjsdocTestName;
      this._value.testId = this._node._tjsdocTestId;
   }

   /** for @testTarget. */
   static _$testTarget()
   {
      const values = this._findAllTagValues(['@test', '@testTarget']);

      if (!values) { return; }

      this._value.testTargets = [];

      for (const value of values)
      {
         const { typeText } = this._eventbus.triggerSync('tjsdoc:system:parser:param:value:parse', value,
          { type: true, name: false, desc: false });

         this._value.testTargets.push(typeText);
      }
   }
}
