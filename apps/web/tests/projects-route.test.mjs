import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {App} from '../src/console/App.tsx';

test('Projects route is reachable and keeps mutation disabled before scan data arrives', () => {
  const html = renderToStaticMarkup(React.createElement(App, {route: '/projects'}));
  assert.match(html, /REPOSITORY ONBOARDING/);
  assert.match(html, /NOT_CONNECTED/);
  assert.match(html, /승인 없는 mutation은 수행하지 않습니다/);
});
