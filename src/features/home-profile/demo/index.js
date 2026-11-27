import React from 'react';
import {registerRootComponent} from 'expo';
import HomeFitWorkspace from '../HomeFitWorkspace.js';
import {exampleHome,exampleProducts} from '../exampleData.ts';
function HomeFitDemo(){return <HomeFitWorkspace products={exampleProducts} exampleProfile={exampleHome}/>;}
registerRootComponent(HomeFitDemo);
