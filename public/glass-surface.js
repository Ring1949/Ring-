(function setupGlassSurfaceFilter(){
  if(document.querySelector("#glass-surface-global-svg"))return;
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("id","glass-surface-global-svg");
  svg.setAttribute("aria-hidden","true");
  svg.setAttribute("focusable","false");
  svg.style.cssText="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  svg.innerHTML=[
    "<defs>",
    "<filter id=\"glass-surface-global-filter\" color-interpolation-filters=\"sRGB\" x=\"0%\" y=\"0%\" width=\"100%\" height=\"100%\">",
    "<feImage x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" preserveAspectRatio=\"none\" result=\"map\" href=\"data:image/svg+xml,%3Csvg viewBox='0 0 240 96' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='r' x1='100%25' y1='0%25' x2='0%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%230000' stop-opacity='0'/%3E%3Cstop offset='100%25' stop-color='red'/%3E%3C/linearGradient%3E%3ClinearGradient id='b' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230000' stop-opacity='0'/%3E%3Cstop offset='100%25' stop-color='blue'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='240' height='96' fill='black'/%3E%3Crect width='240' height='96' rx='48' fill='url(%23r)'/%3E%3Crect width='240' height='96' rx='48' fill='url(%23b)' style='mix-blend-mode:difference'/%3E%3Crect x='7' y='7' width='226' height='82' rx='42' fill='hsl(0 0%25 64%25 / .90)' style='filter:blur(13px)'/%3E%3C/svg%3E\"/>",
    "<feDisplacementMap in=\"SourceGraphic\" in2=\"map\" scale=\"-54\" xChannelSelector=\"R\" yChannelSelector=\"G\" result=\"dispRed\"/>",
    "<feColorMatrix in=\"dispRed\" type=\"matrix\" values=\"1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0\" result=\"red\"/>",
    "<feDisplacementMap in=\"SourceGraphic\" in2=\"map\" scale=\"-48\" xChannelSelector=\"R\" yChannelSelector=\"G\" result=\"dispGreen\"/>",
    "<feColorMatrix in=\"dispGreen\" type=\"matrix\" values=\"0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0\" result=\"green\"/>",
    "<feDisplacementMap in=\"SourceGraphic\" in2=\"map\" scale=\"-42\" xChannelSelector=\"R\" yChannelSelector=\"G\" result=\"dispBlue\"/>",
    "<feColorMatrix in=\"dispBlue\" type=\"matrix\" values=\"0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0\" result=\"blue\"/>",
    "<feBlend in=\"red\" in2=\"green\" mode=\"screen\" result=\"rg\"/>",
    "<feBlend in=\"rg\" in2=\"blue\" mode=\"screen\" result=\"output\"/>",
    "<feGaussianBlur in=\"output\" stdDeviation=\".28\"/>",
    "</filter>",
    "</defs>"
  ].join("");
  document.body.prepend(svg);
  document.body.classList.add("glass-surface-ready");
})();
