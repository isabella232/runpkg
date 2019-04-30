import { react, html, css } from 'https://unpkg.com/rplus';
import ProjectBadge from '../../components/ProjectBadge.js';
import Editor from '../../components/editor.js';
import FormidableIcon from '../../components/logo.js';

const styles = css`/routes/home/index.css`;

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const navigate = url => history.pushState(null, null, url);

export default () => {
  const [packageJSON, setPackageJSON] = react.useState({});
  const [meta, setMeta] = react.useState({
    imports: [],
    exports: [],
    code: '',
    path: '',
  });

  react.useEffect(() => {
    const go = async () => {
      const entry = window.location.search.slice(1).replace(/\/$/, '');
      const root = entry.split('/')[0];

      const pkg = await fetch(`https://unpkg.com/${root}/package.json`).then(
        res => res.json()
      );

      const file = await fetch(`https://unpkg.com/${entry}`);
      const text = await file.text();
      const size = text.length;
      const url = file.url;
      const base = url.replace(/\/[^\/]*\.js/, '');
      const imports = [
        ...(text.match(/(?<=(import|export).*from ['"]).*(?=['"])/g) || []),
        ...(text.match(/(?<=require\(['"])[^)]*(?=['"]\))/g) || []).filter(
          x =>
            x.startsWith('./') ||
            Object.keys(pkg.dependencies || {}).includes(x)
        ),
      ];

      const normaliseRoutes = x => {
        if (x.startsWith(`./`)) {
          return base + x.replace(`./`, `/`);
        } else if (x.startsWith(`https://`)) {
          return x;
        } else {
          return `https://unpkg.com/` + x;
        }
      };

      const dependencies = await Promise.all(
        imports.map(x =>
          fetch(normaliseRoutes(x))
            .then(res => res.text())
            .then(res => ({ [x]: res }))
        )
      ).then(deps => deps.reduce((a, b) => ({ ...a, ...b }), {}));

      setPackageJSON({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        license: pkg.license,
        dependencies: pkg.dependencies,
        readme: `https://www.npmjs.com/package/${pkg.name}`,
      });

      setMeta({
        path: entry.match(/\/.*$/) || '/index.js',
        code: text,
        imports: dependencies,
        size,
        entry,
      });

      window.document.title = 'Dora | ' + pkg.name;
    };

    // Rerender the app when pushState or replaceState are called
    ['pushState', 'replaceState'].map(event => {
      const original = window.history[event];
      window.history[event] = function() {
        original.apply(history, arguments);
        go();
      };
    });
    // Rerender when the back and forward buttons are pressed
    addEventListener('popstate', go);
    // eslint-disable-next-line no-unused-expressions
    location.search && history.replaceState({}, null, location.search);
  }, []);

  const CodeBlock = react.useMemo(
    () => html`
      <${Editor}
        key="editor"
        value=${meta.code.slice(0, 100000)}
        style=${{
          lineHeight: '138%',
          fontFamily: '"dm", monospace',
        }}
        disabled
      />
      <pre>${meta.code.slice(100000)}</pre>
    `,
    [meta.code]
  );

  return html`
    <main class=${styles}>
      ${!window.location.search
        ? html`
            <div className="Overlay">
              <${ProjectBadge}
                color="#ca5688"
                abbreviation="De"
                description="Dora Explorer"
                number="43"
              />
              <p>
                Explore, learn about and perform static analysis on npm
                packages in the browser.
              </p>
              <button
                className="Overlay-Button"
                onClick=${() => navigate('?lodash-es')}
              >
                Start Exploring
              </button>
            </div>
          `
        : html`
            <header>
              <p>An experiment by the folks at Formidable</p>
              ${FormidableIcon}
            </header>
            <article>
              ${CodeBlock}
            </article>
            <aside>
              <h1
                onClick=${() =>
                  navigate(
                    '?' + packageJSON.name + '@' + packageJSON.version
                  )}
              >
                ${packageJSON.name}
              </h1>
              <span className="Info-Block">
                <p>v${packageJSON.version}</p>
                <p>${packageJSON.license}</p>
                <a href=${packageJSON.readme}
                  ><svg viewBox="0 0 780 250">
                    <title>NPM repo link</title>
                    <path
                      fill="#fff"
                      d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z M480,0v200h100V50h50v150h50V50h50v150h50V0H480z M0,200h100V50h50v150h50V0H0V200z"
                    ></path></svg
                ></a>
              </span>
              ${packageJSON.description &&
                html`
                  <p>${packageJSON.description}</p>
                `}
              <div>
                <h3>Dependencies</h3>
                <span>${Object.keys(meta.imports).length}</span>
              </div>
              <ul>
                ${Object.entries(meta.imports).map(
                  ([x, v]) =>
                    html`
                      <li
                        onClick=${() =>
                          navigate(
                            '?' +
                              (x.startsWith('./')
                                ? meta.entry.replace(/\/[^\/]*\.js/, '') +
                                  x.replace('./', '/')
                                : x.replace('https://unpkg.com/', ''))
                          )}
                      >
                        <b>${x.replace('.js', '')}</b>
                        <span>${formatBytes(v.length)}</span>
                      </li>
                    `
                )}
              </ul>
            </aside>
          `}
    </main>
  `;
};
