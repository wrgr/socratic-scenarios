/**
 * Domain registration barrel. Importing this module registers every teaching
 * domain (in order — AJP first, so it is the default). App imports this once so
 * the registry is populated before the DomainProvider mounts.
 */
import './ajp';
import './tire';
import './colreg';

export { listDomains, getDomain } from './registry';
