// Author: JoonHo Lee (jlee296@ua.edu).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadCatalog, generate, validate} from '../../scripts/build.mjs';
import {navigationProblems, activeNavigationHtml, applicationNeighbors} from '../../scripts/navigation.mjs';
const require = createRequire(new URL('../../tools/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const labels = ['Uncertainty', 'Grade reports', 'Reporting rules', 'Multiple criteria', 'Cases', 'Tools'];
const appRoute = (catalog, app, extension = 'html') => `pages/${catalog.parts.find(part => part.key === app.part).slug}/${app.name}.${extension}`;

test('six content categories retain all 84 app destinations and keep profiles under Multiple criteria', () => {
  const catalog = loadCatalog(), navigation = catalog.websiteNavigation;
  assert.deepEqual(navigationProblems(navigation, catalog.parts), []);
  assert.equal(navigation.schemaVersion, 1);
  assert.equal(navigation.collapseBelow, 'xl');
  assert.deepEqual(navigation.sections.map(section => section.label), labels);
  assert.deepEqual(navigation.sections.find(section => section.key === 'criteria').parts, ['4', 'P']);
  assert.equal(navigation.sections.some(section => section.landingPart === 'P'), false);
  assert.deepEqual(navigation.utilities, [{label: 'Catalog', href: 'catalog.qmd'}, {label: 'Terminology', href: 'pages/words.qmd'}]);
  const apps = catalog.apps.filter(app => app.status === 'built');
  assert.equal(apps.length, 84);
  for (const app of apps) assert.equal(navigation.sections.filter(section => section.parts.includes(app.part)).length, 1, app.id);
  const generated = generate(catalog), yaml = generated.get('_nav.yml');
  const headings = [...yaml.matchAll(/^ {6}- id: prx-nav-([^\s]+)$/gm)];
  assert.deepEqual(headings.map(match => match[1]), navigation.sections.map(section => section.key));
  const generatedLabels = headings.map((heading, index) => /^ {8}text: "([^"]+)"/m.exec(yaml.slice(heading.index, headings[index + 1]?.index ?? yaml.length))?.[1]);
  assert.deepEqual(generatedLabels, labels);
  assert.equal((yaml.match(/^ {8}menu:/gm) || []).length, 6);
  const hrefs = [...yaml.matchAll(/^\s+href:\s+["']?([^"'\s]+)["']?\s*$/gm)].map(match => match[1]);
  const knownAppPaths = new Set(apps.map(app => appRoute(catalog, app, 'qmd')));
  assert.equal(hrefs.filter(href => knownAppPaths.has(href)).length, 84);
  for (const app of apps) {
    const path = appRoute(catalog, app, 'qmd');
    assert.equal(hrefs.filter(href => href === path).length, 1, `exactly one menu destination for ${app.id}`);
    const index = navigation.sections.findIndex(section => section.parts.includes(app.part));
    const section = yaml.slice(headings[index].index, headings[index + 1]?.index ?? yaml.length);
    assert.ok(section.includes(path), `${app.id} is in its content category`);
  }
  for (const part of catalog.parts.filter(part => part.key !== 'P')) assert.ok(hrefs.includes(`pages/${part.slug}/index.qmd`), `${part.key} overview remains reachable`);
  const criteria = yaml.slice(headings[3].index, headings[4].index);
  assert.ok(criteria.includes('Common grades'));
  assert.ok(criteria.includes('Domain profiles'));
  assert.ok(criteria.includes('pages/criteria/index.qmd#common-grades'));
  assert.ok(criteria.includes('pages/criteria/index.qmd#domain-profiles'));
  assert.equal((generated.get('pages/criteria/_profile-apps.md').match(/<article /g) || []).length, 5);
  const reordered = structuredClone(navigation);
  reordered.utilities = reordered.utilities.map(utility => ({href: utility.href, label: utility.label}));
  assert.deepEqual(navigationProblems(reordered, catalog.parts), []);
});

test('app sequence follows category order and crosses from common grades to profiles', () => {
  const catalog = loadCatalog();
  const neighbors = applicationNeighbors(catalog.websiteNavigation, catalog);
  assert.equal(neighbors.size, 84);
  for (const section of catalog.websiteNavigation.sections) {
    const apps = section.parts.flatMap(part => catalog.apps.filter(app => app.status === 'built' && app.part === part));
    apps.forEach((app, index) => {
      const current = neighbors.get(appRoute(catalog, app));
      assert.equal(current.label, section.label);
      assert.equal(current.previous?.id, apps[index - 1]?.id);
      assert.equal(current.next?.id, apps[index + 1]?.id);
    });
  }
  assert.equal(neighbors.get('pages/criteria/estimated-budgets.html').next.id, 'P.1');
  assert.equal(neighbors.get('pages/profiles/profile-common-vs-domain.html').previous.id, '4.14');
});

test('standalone and catalog use the canonical page names, with legacy aliases retained', () => {
  const catalog = loadCatalog(), generated = generate(catalog);
  const document = new JSDOM(generated.get('_catalog.md')).window.document;
  const html = document.createElement('div');
  for (const app of catalog.apps.filter(app => app.status === 'built')) {
    const title = catalog.siteCopy[app.name].title;
    const card = document.querySelector(`article:has(h3 a[href="${appRoute(catalog, app)}"])`);
    assert.equal(card.querySelector('h3').textContent, title);
    assert.ok(card.dataset.search.includes(app.title), `legacy alias retained for ${app.id}`);
    html.innerHTML = generated.get(`embed/${app.name}.html`).match(/<h1 class="prx-embed-title">.*?<\/h1>/)[0];
    assert.equal(html.textContent, title, `standalone name for ${app.id}`);
  }
  const invalid = structuredClone(catalog);
  invalid.siteCopy['case-zero'].title = 'A mismatched title';
  assert.ok(validate(invalid).some(message => message.includes('the title of pages/uncertainty/case-zero.qmd must match')));
});

test('missing, repeated, unreachable, unsafe and unexpected navigation configurations fail closed', () => {
  const catalog = loadCatalog();
  const changes = [
    ['missing', () => null],
    ['missing section', n => { n.sections.pop(); return n; }],
    ['repeated membership', n => { n.sections[0].parts.push('P'); return n; }],
    ['unknown part', n => { n.sections[0].parts[0] = 'X'; return n; }],
    ['unreachable profiles', n => { n.sections[3].parts = ['4']; return n; }],
    ['unsafe utility', n => { n.utilities[0].href = 'https://example.test/'; return n; }],
    ['script utility', n => { n.utilities[0].href = 'javascript:alert(1)'; return n; }],
    ['unexpected field', n => { n.extra = true; return n; }],
    ['profile top category', n => { n.sections[3].landingPart = 'P'; return n; }],
    ['duplicate key', n => { n.sections[1].key = n.sections[0].key; return n; }],
    ['reordered categories', n => { [n.sections[0], n.sections[1]] = [n.sections[1], n.sections[0]]; return n; }],
    ['unsupported collapse breakpoint', n => { n.collapseBelow = 'never'; return n; }],
  ];
  for (const [name, change] of changes) {
    const bad = structuredClone(catalog);
    bad.websiteNavigation = change(bad.websiteNavigation);
    assert.ok(validate(bad).some(error => error.startsWith('navigation:')), name);
  }
});

function simulate(root, path, {nativeIds = false} = {}) {
  const catalog = loadCatalog(), navigation = catalog.websiteNavigation;
  const href = path => new URL(path, root).href;
  const sections = navigation.sections.map(section => {
    const slug = catalog.parts.find(part => part.key === section.landingPart).slug;
    const links = [`<li><a class="dropdown-item" href="${href(`pages/${slug}/index.html`)}"><span class="dropdown-text">Overview</span></a></li>`];
    if (section.key === 'criteria') {
      links.push(`<li><a class="dropdown-item" href="${href('pages/criteria/index.html#common-grades')}"><span class="dropdown-text">Common grades</span></a></li>`);
      links.push(`<li><a class="dropdown-item" href="${href('pages/criteria/index.html#domain-profiles')}"><span class="dropdown-text">Domain profiles</span></a></li>`);
    }
    for (const app of catalog.apps.filter(app => app.status === 'built' && section.parts.includes(app.part))) links.push(`<li><a class="dropdown-item" href="${href(appRoute(catalog, app))}"><span class="dropdown-text">${app.id}</span></a></li>`);
    const id = `${nativeIds ? 'nav-menu-' : ''}prx-nav-${section.key}`;
    return `<li class="nav-item dropdown"><a class="nav-link dropdown-toggle" href="#" id="${id}" role="button" data-bs-toggle="dropdown" aria-expanded="false"><span class="menu-text">${section.label}</span></a><ul class="dropdown-menu" aria-labelledby="${id}">${links.join('')}</ul></li>`;
  });
  const utilities = navigation.utilities.map(utility => `<li class="nav-item"><a class="nav-link" href="${href(utility.href.replace(/\.qmd$/, '.html'))}"><span class="menu-text">${utility.label}</span></a></li>`);
  const html = `<nav class="navbar"><a class="navbar-brand" href="${root}">postrank Explorer</a><button class="navbar-toggler">Menu</button><div class="navbar-collapse"><ul class="navbar-nav">${sections.join('')}${utilities.join('')}</ul></div></nav>${activeNavigationHtml(navigation, catalog.parts)}`;
  const window = new JSDOM(html, {url: href(path), runScripts: 'dangerously'}).window;
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

test('every app activates exactly its content-category parent and exact child at root, subpath and file URLs', () => {
  const catalog = loadCatalog();
  for (const root of ['http://127.0.0.1:1234/', 'http://127.0.0.1:1234/postrank-explorer/', 'file:///tmp/candidate/']) {
    for (const app of catalog.apps.filter(app => app.status === 'built')) {
      const path = appRoute(catalog, app) + '?preset=example#what-to-try', window = simulate(root, path);
      try {
        assert.equal(window.location.href, new URL(path, root).href, `${app.id}: URL is not rewritten`);
        const active = [...window.document.querySelectorAll('.nav-link.active')];
        const section = catalog.websiteNavigation.sections.find(section => section.parts.includes(app.part));
        assert.equal(active.length, 1, `${app.id}: one parent`);
        assert.equal(active[0].querySelector('.menu-text').textContent, section.label);
        assert.equal(active[0].getAttribute('aria-current'), 'location');
        const children = [...window.document.querySelectorAll('.dropdown-item.active')];
        assert.equal(children.length, 1, `${app.id}: one child`);
        assert.equal(children[0].href, new URL(appRoute(catalog, app), root).href);
        assert.equal(children[0].getAttribute('aria-current'), 'page');
      } finally { window.close(); }
    }
  }
});

test('category overviews and native Quarto parent IDs preserve accurate current-location semantics', () => {
  const catalog = loadCatalog();
  for (const section of catalog.websiteNavigation.sections) {
    const slug = catalog.parts.find(part => part.key === section.landingPart).slug;
    for (const nativeIds of [false, true]) {
      const path = `pages/${slug}/index.html`, window = simulate('https://example.test/project/', path, {nativeIds});
      try {
        const active = [...window.document.querySelectorAll('.nav-link.active')];
        assert.equal(active.length, 1);
        assert.equal(active[0].querySelector('.menu-text').textContent, section.label);
        assert.equal(active[0].getAttribute('aria-current'), 'page');
        const children = [...window.document.querySelectorAll('.dropdown-item.active')];
        assert.equal(children.length, 1);
        assert.equal(children[0].href, new URL(path, 'https://example.test/project/').href);
      } finally { window.close(); }
    }
  }
});

test('anchored common/profile shortcuts never create an incorrect app selection', () => {
  for (const hash of ['#common-grades', '#domain-profiles', '#unrelated-heading']) {
    const window = simulate('https://example.test/project/', `pages/criteria/index.html${hash}`);
    try {
      const parents = [...window.document.querySelectorAll('.nav-link.active')];
      assert.equal(parents.length, 1);
      assert.equal(parents[0].querySelector('.menu-text').textContent, 'Multiple criteria');
      const children = [...window.document.querySelectorAll('.dropdown-item.active')];
      assert.equal(children.length, 1);
      assert.ok(children[0].href.startsWith('https://example.test/project/pages/criteria/index.html'));
      if (hash !== '#unrelated-heading') assert.equal(children[0].hash, hash);
      const before = window.location.href;
      window.location.hash = '#domain-profiles';
      window.dispatchEvent(new window.Event('hashchange'));
      assert.equal(window.location.pathname, new URL(before).pathname);
      assert.equal(window.location.hash, '#domain-profiles');
      const changed = [...window.document.querySelectorAll('.dropdown-item.active')];
      assert.equal(changed.length, 1);
      assert.equal(changed[0].hash, '#domain-profiles');
    } finally { window.close(); }
  }
});

test('prefix lookalikes, home and utility pages do not select a content category; no-script links remain reachable', () => {
  for (const path of ['index.html', 'catalog.html?part=P', 'pages/words.html', 'pages/profiles-extra/example.html', 'pages/criteria-extra/two-scores.html']) {
    const window = simulate('https://example.test/project/', path);
    try {
      assert.equal(window.document.querySelectorAll('.dropdown-toggle.active').length, 0, path);
      assert.equal(window.document.querySelectorAll('.dropdown-item.active').length, 0, path);
      const fallback = window.document.querySelector('noscript').textContent;
      assert.ok(fallback.includes('navbar-collapse'));
      assert.ok(fallback.includes('dropdown-menu'));
      assert.match(fallback, /display\s*:\s*block/);
      assert.equal(window.document.querySelectorAll('.dropdown-menu').length, 6);
      assert.equal(window.document.querySelectorAll('.dropdown-item[href*="/pages/profiles/"]').length, 5);
    } finally { window.close(); }
  }
});
