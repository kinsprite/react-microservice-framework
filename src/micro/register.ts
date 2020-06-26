import { Reducer } from 'redux';
import { Saga } from 'redux-saga';
import { Epic } from 'redux-observable';

import { loadMultiStyles } from './loadStyle';
import { loadMultiScripts } from './loadScript';

import { MetadataRender } from '../util';

export enum AppLoadState {
  Init,
  Loading,
  Loaded,
}

export interface AppInfo {
  // Components map for rendering, such as: { default: MyComponent }
  components?: {
    [key: string]: React.Component | React.FC;
  };
  /* Global redux store here, but recommend to use isolated store in every app */
  reducer?: Reducer;
  saga?: Saga; // will NOT save in register
  sagaArgs?: Array<any>; // will NOT save in register
  epic?: Epic; // will NOT save in register
}

export interface AppRegisterInfo extends AppInfo {
  id: string; // as 'serviceName' in manifest
  dependencies: string[]; // dependencies ids
  entries: string[]; // css/js entries files
  renders: MetadataRender[];
  promiseLoading?: Promise<boolean>;
  loadState?: AppLoadState,
}

interface AppRegisterInfoMap {
  [id: string]: AppRegisterInfo;
}

export interface AppRegisterRenderItem {
  app: AppRegisterInfo;
  render: MetadataRender;
}

class AppRegister {
  // appId to AppRegisterInfo
  apps: AppRegisterInfoMap = {}

  getAppsAsArray() {
    return Object.keys(this.apps).map((id) => this.apps[id]);
  }

  filterRenderItems(renderId: string) {
    const renderItems = [] as AppRegisterRenderItem[];

    this.getAppsAsArray().forEach((app) => {
      app.renders.forEach((metaRender) => {
        if (metaRender.renderId === renderId) {
          renderItems.push({
            app,
            render: metaRender,
          });
        }
      });
    });

    return renderItems;
  }

  getApps() {
    return this.apps;
  }

  getApp(id: string) {
    return this.apps[id];
  }

  setAppLoadState(id: string, loadState: AppLoadState) {
    const app = this.apps[id];

    if (app) {
      app.loadState = loadState;
    }
  }

  getAppLoadState(id: string) {
    const app = this.apps[id];
    return app ? app.loadState : AppLoadState.Init;
  }

  isAppLoaded(id: string) {
    return this.getAppLoadState(id) === AppLoadState.Loaded;
  }

  // use in sub-Apps to register routes' component and other info (such as redux)
  registerFromSubApp(id: string, appInfo: AppInfo) : boolean {
    const app = this.apps[id];

    if (app && appInfo) {
      Object.assign(app, appInfo);
      return true;
    }

    return false;
  }

  // use in framework to init apps info, or append apps which not render on 'root' later
  registerFromMetadata(apps: AppRegisterInfo[]) {
    apps.forEach((app) => {
      this.apps[app.id] = {
        components: {},
        ...app,
        promiseLoading: null,
        loadState: AppLoadState.Init,
      };
    });
  }

  loadApp(id: string) : Promise<boolean> {
    const app = this.getApp(id);

    if (!app) {
      return Promise.reject(new Error(`Not app for id: ${id}`));
    }

    if (app.dependencies.length === 0) {
      return this.loadAppIgnoreDependencies(id);
    }

    const dependenciesTopo = this.generateDependenciesTopo(app);

    return new Promise((resolve, reject) => {
      Promise.all(dependenciesTopo.map((appId) => this.loadAppIgnoreDependencies(appId))).then(
        () => resolve(true),
        (e) => reject(e),
      );
    });
  }

  generateDependenciesTopo(appBegin: AppRegisterInfo): string[] {
    const topo : string[] = [];

    enum Color { White, Gray, Black}
    const nodesVisited: {[id: string]: Color} = {};

    // DeepFirstVisit
    const visitApp = (app: AppRegisterInfo) => {
      nodesVisited[app.id] = Color.Gray;

      app.dependencies.forEach((depId) => {
        const appDep = this.getApp(depId);

        if (appDep) {
          if (nodesVisited[depId] !== Color.Gray && nodesVisited[depId] !== Color.Black) {
            visitApp(appDep);
          }
        } else {
          throw new Error(`Not missing dependency app '${depId}' for app '${app.id}'.`);
        }
      });

      nodesVisited[app.id] = Color.Black;
      // insert new item to the front
      topo.unshift(app.id);
    };

    visitApp(appBegin);
    return topo;
  }

  loadAppIgnoreDependencies(id: string) : Promise<boolean> {
    const app = this.getApp(id);

    if (!app) {
      return Promise.reject(new Error(`Not app for id: ${id}`));
    }

    if (app.promiseLoading) {
      return app.promiseLoading;
    }

    app.promiseLoading = new Promise((resolve, reject) => {
      app.loadState = AppLoadState.Loading;
      Promise.all([
        loadMultiStyles(app.entries.filter((x) => x.toLowerCase().endsWith('.css'))),
        loadMultiScripts(app.entries.filter((x) => x.toLowerCase().endsWith('.js'))),
      ]).then(
        () => {
          app.loadState = AppLoadState.Loaded;
          resolve(true);
        },
        (e) => {
          app.loadState = AppLoadState.Init;
          app.promiseLoading = null;
          reject(e);
        },
      );
    });

    return app.promiseLoading;
  }
}

const register = new AppRegister();

export default function getRegister() : AppRegister {
  return register;
}
