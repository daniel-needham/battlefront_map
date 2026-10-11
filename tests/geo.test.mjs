import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCoordinates,projectOnGlobe,shortestLongitude,tileCoordinates} from '../dist/geo.js';
test('coordinates accept negative, fractional and whitespace-separated destinations',()=>{assert.deepEqual(parseCoordinates(' -33.8688, 151.2093 '),{lat:-33.8688,lon:151.2093});assert.deepEqual(parseCoordinates('.5 -.25'),{lat:.5,lon:-.25});});
test('invalid, ambiguous and unmappable polar coordinates are rejected',()=>{for(const value of ['','London','0,0,0','NaN,2','91,0','0,181','90,0','1e2,0'])assert.throws(()=>parseCoordinates(value));});
test('destination lies at centre when globe faces it, including southern hemisphere',()=>{for(const point of [{lat:51.5074,lon:-.1278},{lat:-33.8688,lon:151.2093},{lat:0,lon:180}]){const p=projectOnGlobe(point,point);assert.ok(Math.abs(p.x)<1e-10&&Math.abs(p.y)<1e-10);assert.equal(p.visible,true);}});
test('far side is hidden and rotation takes the short path across the dateline',()=>{assert.equal(projectOnGlobe({lat:0,lon:180},{lat:0,lon:0}).visible,false);assert.equal(shortestLongitude(179,-179),2);assert.equal(shortestLongitude(-179,179),-2);});
test('tile selection stays inside the world at dateline and Mercator limits',()=>{for(const lat of [-85.05112878,0,85.05112878])for(const lon of [-180,180]){const p=tileCoordinates(lat,lon,13);assert.ok(p.x>=0&&p.x<8192&&p.y>=0&&p.y<8192);}assert.deepEqual(tileCoordinates(0,0,4),{x:8,y:8});});
