import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {App} from '../src/console/App.tsx';

test('planned menu routes render an honest read-only screen instead of the fallback', () => {
  const routes = [
    ['/workbench', 'Workbench'], ['/runs', 'Runs'], ['/reviews', 'Reviews'],
    ['/quality', 'Quality'], ['/knowledge', 'Knowledge'],
    ['/agents-automation', 'Agents & Automation'], ['/environments', 'Environments'],
    ['/operations', 'Operations'], ['/settings', 'Settings'],
  ];
  for (const [route, title] of routes) {
    const html = renderToStaticMarkup(React.createElement(App, {route}));
    assert.doesNotMatch(html, /페이지를 사용할 수 없습니다/);
    assert.match(html, new RegExp(title.replace('&', '&amp;')));
    assert.match(html, /UNAVAILABLE/);
  }
});

