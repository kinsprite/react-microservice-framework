import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';

import getRegister from './register';
import { RedirectToDefaultRoute } from '../util';

interface AsyncAppProps {
  appId: string;
  routePath: string;
  redirectOnFail?: string;
  [key: string]: any;
}

enum LoadedState {
  Init,
  OK,
  Failed,
}

function AsyncApp(props : AsyncAppProps) : React.ReactElement {
  const { appId, routePath, redirectOnFail } = props;
  const register = getRegister();
  const app = register.getApp(appId);

  const isAppLoaded = app && register.isAppLoaded(app.id);

  const [once] = useState(1);
  const [result, setResult] = useState(
    isAppLoaded ? {
      loaded: LoadedState.OK,
      component: app && app.component, // can't use React.FC in useState() for React.createElement
    } : {
      loaded: LoadedState.Init,
      component: null,
    },
  );

  useEffect(() => {
    let isMounted = true;

    if (app && result.loaded === LoadedState.Init) {
      register.loadApp(app.id).then(() => {
        if (isMounted) {
          setResult({
            loaded: LoadedState.OK,
            component: app.component,
          });
        }
      }).catch(() => {
        if (isMounted) {
          setResult({
            loaded: LoadedState.Failed,
            component: null,
          });
        }
      });
    }

    return () => { isMounted = false; };
  }, [once]);

  if (result.loaded === LoadedState.Failed) {
    return redirectOnFail ? <Redirect to={redirectOnFail} /> : RedirectToDefaultRoute(routePath);
  }

  return (result.loaded === LoadedState.OK && result.component)
    ? React.createElement(result.component as any, props) : <></>;
}

export default AsyncApp;
