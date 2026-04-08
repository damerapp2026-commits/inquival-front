import{c as l,r as d,j as s}from"./index-CN3Sb0aY.js";/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=l("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=l("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);function m({page:e,totalPages:n,onPageChange:r}){const[o,i]=d.useState(String(e));d.useEffect(()=>{i(String(e))},[e]);const c=()=>{const t=parseInt(o,10);!isNaN(t)&&t>=1&&t<=n?r(t):i(String(e))};return n<=1?null:s.jsxs("div",{className:"flex items-center justify-center gap-2 mt-4",children:[s.jsx("button",{onClick:()=>r(e-1),disabled:e<=1,className:"p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50",children:s.jsx(a,{size:16})}),s.jsx("span",{className:"text-sm text-gray-600",children:"Página"}),s.jsx("input",{type:"text",value:o,onChange:t=>i(t.target.value),onBlur:c,onKeyDown:t=>t.key==="Enter"&&c(),className:"w-12 text-center text-sm border rounded-lg py-1 focus:ring-2 focus:ring-green-500 focus:outline-none"}),s.jsxs("span",{className:"text-sm text-gray-600",children:["de ",n]}),s.jsx("button",{onClick:()=>r(e+1),disabled:e>=n,className:"p-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50",children:s.jsx(u,{size:16})})]})}export{m as P};
