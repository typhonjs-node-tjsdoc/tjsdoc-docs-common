import AbstractDoc   from './AbstractDoc.js';

/**
 * Provides the common base for documenting tests.
 *
 * The following tags / annotations are supported by AbstractTestDoc and children implementations:
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
export default class AbstractTestDoc extends AbstractDoc
{

   /**
    * The following methods provide the @xxx tags / annotations supported in AbstractTestDoc. Adding methods makes it
    * easy to detect any unknown tags when a method is missing. Child classes may also add the tags that they support.
    */

   /** @ignore */ _tag_test() {}
   /** @ignore */ _tag_testTarget() {}

   /** set name and testId from special tjsdoc property. */
   _$name()
   {
      this._value.name = this._node._tjsdocTestName;
      this._value.testId = this._node._tjsdocTestId;
   }

   /** for @testTarget. */
   _$testTarget()
   {
      const values = this._findAllTagValues(['@test', '@testTarget']);

      if (!values) { return; }

      this._value.testTargets = [];

      for (const value of values)
      {
         const { typeText } = this._eventbus.triggerSync('tjsdoc:parse:param:value', value,
          { type: true, name: false, desc: false });

         this._value.testTargets.push(typeText);
      }
   }
}
