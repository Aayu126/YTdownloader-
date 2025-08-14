// polyfill.js
import { Blob, File } from 'buffer';

if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob;
if (typeof globalThis.File === 'undefined') globalThis.File = File;

import './server.js';
