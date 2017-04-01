import CoreDocResolver from './resolver/CoreDocResolver.js';

import * as CommonDocs from './doc/';

/**
 * Adds all common doc plugins.
 *
 * @param {PluginEvent} ev - The plugin event.
 *
 * @ignore
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   // Instances are being loaded into the plugin manager so auto log filtering needs an explicit filter.
   eventbus.trigger('log:filter:add', {
      type: 'inclusive',
      name: 'tjsdoc-docs-common-filter',
      filterString: '(tjsdoc-docs-common\/dist|tjsdoc-docs-common\/src)'
   });

   eventbus.trigger('plugins:add', { name: 'tjsdoc-core-doc-resolver', instance: new CoreDocResolver() });

   // Add event binding to retrieve all common doc object generator classes.
   eventbus.on('tjsdoc:data:docs:common:get', () => CommonDocs);
}
