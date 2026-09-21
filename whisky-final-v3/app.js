
(function(){
  "use strict";

  var products = [
    {id:"ard",de:"Ardmore 28 Jahre",en:"Ardmore 28 Years",region:"Highland",price:259,img:"https://www.whisky-bibliothek.ch/wp-content/uploads/2026/09/Ardmore-28yo_chapter-one_front.jpg"},
    {id:"led",de:"Ledaig 18 Jahre",en:"Ledaig 18 Years",region:"Islands",price:149,img:"https://www.whisky-bibliothek.ch/wp-content/uploads/2026/09/Ledaig-Tobermory-18-years-C.Dully-Selection-56.8-Sherry-Butt-Cask-no.-700260-239-Bottles-Islands-Mull-Single-Mail-Scotch-Whisky.jpg"},
    {id:"kil",de:"Kilkerran 16 Jahre",en:"Kilkerran 16 Years",region:"Campbeltown",price:85,img:"https://www.whisky-bibliothek.ch/wp-content/uploads/2026/09/Kilkerran-16y-46-2026-100-Sherry-Glengyle-Campbeltown-Single-Malt-Whisky.jpg"},
    {id:"spr",de:"Springbank 1994 Jahrgang",en:"Springbank 1994 Vintage",region:"Campbeltown",price:89,img:"https://www.whisky-bibliothek.ch/wp-content/uploads/2026/08/Springbank-31-years-old-1994-80-Bourbon-10-Sherry-10-Red-Wine-451-vol.-1180-bottles-Campbeltown-Single-Malt-Whisky.jpg"}
  ];

  var T = {
    de:{
      customerApp:"Kunden-App",salesCrm:"Vertrieb / CRM",home:"Home",shop:"Shop",finder:"Finder",samples:"Proben",profile:"Profil",
      heroTitle:"Ihr persönlicher Whiskyberater.",heroText:"Intelligente Empfehlungen, Proben, seltene Flaschen und automatisierte Verkaufsprozesse.",
      newStock:"Neu im Sortiment",addCart:"In den Warenkorb",cart:"Warenkorb",emptyCart:"Warenkorb ist leer.",checkout:"Checkout",
      sampleBox:"Verkostungsbox",addSample:"Zur Box hinzufügen",yourBox:"Ihre Verkostungsbox",emptySamples:"Noch keine Proben ausgewählt.",
      myProfile:"Mein Profil",dashboard:"Dashboard",customers:"Kunden",campaigns:"Kampagnen",automations:"Automatisierungen",app:"App",
      subscribers:"E-Mail-Abonnenten",segments:"Segmente",revenue:"Beeinflusster Umsatz",attention:"Benötigt Aufmerksamkeit",
      att1:"17 Probenkäufer ohne Flaschenkauf",att2:"11 Wunschlisten-Produkte wieder verfügbar",att3:"6 VIP-Kunden sehen seltene Flaschen",
      recent:"Letzte Aktivitäten",newCampaign:"Neue Kampagne",camp1:"Neue Campbeltown-Abfüllungen",camp2:"Seltene Flaschen – VIP-Vorschau",
      auto1:"Probe → Flasche",auto2:"Wunschliste – wieder verfügbar",auto3:"VIP- / Sammler-Hinweis",
      auto1m:"Nach einem Probenkauf automatisch die passende ganze Flasche empfehlen.",
      auto2m:"Kunden automatisch informieren, sobald ein Wunschlisten-Produkt wieder verfügbar ist.",
      auto3m:"Seltene Abfüllungen zuerst an VIP- und Sammler-Segmente senden.",
      run:"Jetzt ausführen",on:"AN",off:"AUS",search:"Produkte, Destillerien, Regionen suchen...",searchBtn:"Suche",
      step:"Schritt",back:"Zurück",next:"Weiter",recommendation:"Empfehlung",recommendText:"Kilkerran 16 Jahre passt am besten zu Ihren Antworten.",
      toastAdded:"Zum Warenkorb hinzugefügt",toastAutomation:"Automatisierung ausgeführt",toastCampaign:"Kampagne geöffnet",toastCustomer:"Kundenprofil geöffnet"
    },
    en:{
      customerApp:"Customer App",salesCrm:"Sales / CRM",home:"Home",shop:"Shop",finder:"Finder",samples:"Samples",profile:"Profile",
      heroTitle:"Your personal whisky advisor.",heroText:"Smart recommendations, samples, rare bottles and automated sales workflows.",
      newStock:"New in Stock",addCart:"Add to Cart",cart:"Cart",emptyCart:"Cart is empty.",checkout:"Checkout",
      sampleBox:"Tasting Box",addSample:"Add to Box",yourBox:"Your Tasting Box",emptySamples:"No samples selected yet.",
      myProfile:"My Profile",dashboard:"Dashboard",customers:"Customers",campaigns:"Campaigns",automations:"Automations",app:"App",
      subscribers:"Email Subscribers",segments:"Segments",revenue:"Revenue Influenced",attention:"Needs Attention",
      att1:"17 sample buyers without bottle purchase",att2:"11 wishlist products back in stock",att3:"6 VIP customers viewing rare bottles",
      recent:"Recent Activity",newCampaign:"New Campaign",camp1:"New Campbeltown Arrivals",camp2:"Rare Bottles – VIP Preview",
      auto1:"Sample → Bottle",auto2:"Wishlist Back in Stock",auto3:"VIP / Collector Alert",
      auto1m:"Recommend the matching full bottle automatically after a sample purchase.",
      auto2m:"Automatically alert customers when a wishlist product is back in stock.",
      auto3m:"Send rare releases to VIP and collector segments first.",
      run:"Run now",on:"ON",off:"OFF",search:"Search products, distilleries, regions...",searchBtn:"Search",
      step:"Step",back:"Back",next:"Next",recommendation:"Recommendation",recommendText:"Kilkerran 16 Years is the best match for your answers.",
      toastAdded:"Added to cart",toastAutomation:"Automation executed",toastCampaign:"Campaign opened",toastCustomer:"Customer profile opened"
    }
  };

  var state = {
    lang:"de", mode:"customer", customerView:"home", crmView:"dashboard",
    cart:[], sampleCart:[], finderStep:0, answers:{},
    automations:{auto1:true,auto2:true,auto3:true},
    activity:[
      "09:42 · Wishlist Back in Stock · 11 customers",
      "09:16 · VIP / Collector Alert · 6 customers",
      "08:55 · Sample → Bottle · 17 customers"
    ]
  };

  var questions = {
    de:[
      ["Was ist Ihnen am wichtigsten?",["Geschmack","Region","Preis","Anlass"]],
      ["Welcher Stil gefällt Ihnen?",["Rauchig","Sherry","Fruchtig","Mild"]],
      ["Welche Region?",["Islay","Campbeltown","Highlands","Speyside"]],
      ["Ihr Budget?",["< 80 CHF","80–150 CHF","150–300 CHF","300+ CHF"]],
      ["Was suchen Sie?",["Flasche","Proben","Geschenk","Rarität"]]
    ],
    en:[
      ["What matters most?",["Taste","Region","Price","Occasion"]],
      ["Which style?",["Smoky","Sherry","Fruity","Soft"]],
      ["Which region?",["Islay","Campbeltown","Highlands","Speyside"]],
      ["Your budget?",["< 80 CHF","80–150 CHF","150–300 CHF","300+ CHF"]],
      ["What are you looking for?",["Bottle","Samples","Gift","Rare bottle"]]
    ]
  };

  function q(s){ return document.querySelector(s); }
  function qa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function tr(k){ return T[state.lang][k] || k; }
  function money(v){ return Number(v).toFixed(2)+" CHF"; }
  function nameOf(p){ return p[state.lang]; }
  function samplePrice(id){ return id==="kil"?12.5:id==="led"?16:id==="ard"?24:89; }

  function setText(selector,text){ var el=q(selector); if(el) el.textContent=text; }
  function setDisplay(selector,show,displayValue){ var el=q(selector); if(el) el.style.display=show?(displayValue||"block"):"none"; }

  function productCards(){
    return products.map(function(p){
      return '<article class="product-card">'+
        '<div class="product-image"><img src="'+p.img+'" alt=""></div>'+
        '<div class="product-body"><div class="eyebrow">'+p.region+'</div><h3>'+nameOf(p)+'</h3>'+
        '<div class="price">'+money(p.price)+'</div>'+
        '<button class="btn primary full" data-action="add-cart" data-id="'+p.id+'">'+tr("addCart")+'</button></div></article>';
    }).join("");
  }

  function renderProducts(){
    var home=q("#homeGrid"), shop=q("#shopGrid");
    var html=productCards();
    if(home) home.innerHTML=html;
    if(shop) shop.innerHTML=html;
    var sample=q("#sampleGrid");
    if(sample){
      sample.innerHTML=products.map(function(p){
        return '<article class="product-card"><div class="product-image"><img src="'+p.img+'" alt=""></div>'+
          '<div class="product-body"><div class="eyebrow">Sample</div><h3>'+nameOf(p)+'</h3>'+
          '<div class="price">'+money(samplePrice(p.id))+'</div>'+
          '<button class="btn primary full" data-action="add-sample" data-id="'+p.id+'">'+tr("addSample")+'</button></div></article>';
      }).join("");
    }
  }

  function addCart(id){
    var x=state.cart.find(function(i){return i.id===id;});
    if(x)x.qty++; else state.cart.push({id:id,qty:1});
    renderCart(); toast(tr("toastAdded"));
  }
  function updateCart(id,d){
    var x=state.cart.find(function(i){return i.id===id;}); if(!x)return;
    x.qty+=d; if(x.qty<=0) state.cart=state.cart.filter(function(i){return i.id!==id;});
    renderCart();
  }
  function renderCart(){
    var rows=q("#cartRows"), total=q("#cartTotal"), badge=q("#cartBadge");
    var sum=0,count=0;
    if(rows){
      if(!state.cart.length) rows.innerHTML='<p class="muted">'+tr("emptyCart")+'</p>';
      else rows.innerHTML=state.cart.map(function(i){
        var p=products.find(function(x){return x.id===i.id;}); sum+=p.price*i.qty; count+=i.qty;
        return '<div class="cart-row"><img src="'+p.img+'" alt=""><div><strong>'+nameOf(p)+'</strong>'+
          '<div class="qty"><button data-action="cart-minus" data-id="'+p.id+'">−</button><span>'+i.qty+'</span><button data-action="cart-plus" data-id="'+p.id+'">+</button></div></div><strong>'+money(p.price*i.qty)+'</strong></div>';
      }).join("");
    }
    if(total) total.textContent=money(sum);
    if(badge) badge.textContent=count;
  }

  function addSample(id){
    var x=state.sampleCart.find(function(i){return i.id===id;});
    if(x)x.qty++; else state.sampleCart.push({id:id,qty:1});
    renderSamples();
  }
  function updateSample(id,d){
    var x=state.sampleCart.find(function(i){return i.id===id;}); if(!x)return;
    x.qty+=d; if(x.qty<=0) state.sampleCart=state.sampleCart.filter(function(i){return i.id!==id;});
    renderSamples();
  }
  function renderSamples(){
    var rows=q("#sampleCartRows"), total=q("#sampleTotal");
    var sum=0;
    if(rows){
      if(!state.sampleCart.length) rows.innerHTML='<p class="muted">'+tr("emptySamples")+'</p>';
      else rows.innerHTML=state.sampleCart.map(function(i){
        var p=products.find(function(x){return x.id===i.id;}); var pr=samplePrice(p.id); sum+=pr*i.qty;
        return '<div class="sample-row"><img src="'+p.img+'" alt=""><div><strong>'+nameOf(p)+'</strong>'+
        '<div class="qty"><button data-action="sample-minus" data-id="'+p.id+'">−</button><span>'+i.qty+'</span><button data-action="sample-plus" data-id="'+p.id+'">+</button></div></div><strong>'+money(pr*i.qty)+'</strong></div>';
      }).join("");
    }
    if(total) total.textContent=money(sum);
  }

  function renderFinder(){
    var root=q("#finderOptions"); if(!root)return;
    var item=questions[state.lang][state.finderStep];
    setText("#finderStep",tr("step")+" "+(state.finderStep+1)+" / 5");
    setText("#finderQuestion",item[0]); setText("#finderPrev",tr("back")); setText("#finderNext",tr("next"));
    setText("#recommendTitle",tr("recommendation")); setText("#recommendText",tr("recommendText"));
    root.innerHTML=item[1].map(function(o){
      return '<button class="finder-option '+(state.answers[state.finderStep]===o?"on":"")+'" data-action="finder-option" data-value="'+o+'">'+o+'</button>';
    }).join("");
  }

  function renderCRM(){
    setText("#crmTitle",tr("salesCrm")); setText("#kCustomers",tr("customers")); setText("#kSubscribers",tr("subscribers"));
    setText("#kSegments",tr("segments")); setText("#kRevenue",tr("revenue")); setText("#attentionTitle",tr("attention"));
    setText("#att1",tr("att1")); setText("#att2",tr("att2")); setText("#att3",tr("att3")); setText("#recentTitle",tr("recent"));
    setText("#customersTitle",tr("customers")); setText("#campaignsTitle",tr("campaigns")); setText("#automationsTitle",tr("automations"));
    setText("#newCampaignBtn",tr("newCampaign")); setText("#camp1",tr("camp1")); setText("#camp2",tr("camp2"));
    ["auto1","auto2","auto3"].forEach(function(id){
      setText("#"+id+"Title",tr(id)); setText("#"+id+"Meta",tr(id+"m"));
      var sw=q('[data-auto-switch="'+id+'"]'); if(sw){sw.classList.toggle("off",!state.automations[id]); sw.textContent=state.automations[id]?tr("on"):tr("off");}
      var run=q('[data-auto-run="'+id+'"]'); if(run)run.textContent=tr("run");
    });
    var activity=q("#activityLog"); if(activity) activity.innerHTML=state.activity.map(function(x){return '<div class="activity-item">'+x+'</div>';}).join("");
    var autoLog=q("#autoLog"); if(autoLog && !autoLog.innerHTML) autoLog.innerHTML='<div class="activity-item">—</div>';
  }

  function renderText(){
    setText("#customerMode",tr("customerApp")); setText("#crmMode",tr("salesCrm"));
    setText("#heroTitle",tr("heroTitle")); setText("#heroText",tr("heroText")); setText("#newStockTitle",tr("newStock"));
    setText("#navHome",tr("home")); setText("#navShop",tr("shop")); setText("#navFinder",tr("finder")); setText("#navSamples",tr("samples")); setText("#navProfile",tr("profile"));
    setText("#samplesTitle",tr("sampleBox")); setText("#yourBoxTitle",tr("yourBox")); setText("#profileTitle",tr("myProfile"));
    setText("#cartTitle",tr("cart")); setText("#checkoutBtn",tr("checkout"));
    setText("#crmNavDashboard",tr("dashboard")); setText("#crmNavCustomers",tr("customers")); setText("#crmNavCampaigns",tr("campaigns")); setText("#crmNavAutomations",tr("automations")); setText("#crmNavApp",tr("app"));
    var search=q("#searchInput"), sb=q("#searchBtn"); if(search)search.placeholder=tr("search"); if(sb)sb.textContent=tr("searchBtn");
    renderProducts(); renderCart(); renderSamples(); renderFinder(); renderCRM();
  }

  function showCustomerView(v){
    state.customerView=v;
    closeMenu();
    qa(".customer-view").forEach(function(x){x.classList.remove("on");});
    var el=q("#view-"+v); if(el)el.classList.add("on");
    qa('[data-customer-view]').forEach(function(x){x.classList.toggle("on",x.getAttribute("data-customer-view")===v);});
  }
  function showCrmView(v){
    state.crmView=v;
    closeMenu();
    qa(".crm-view").forEach(function(x){x.classList.remove("on");});
    var el=q("#crm-"+v); if(el)el.classList.add("on");
    qa('[data-crm-view]').forEach(function(x){x.classList.toggle("on",x.getAttribute("data-crm-view")===v);});
  }
  function setMode(m){
    state.mode=m;
    var customer=q("#customerArea"), crm=q("#crmArea");
    if(customer)customer.style.display=m==="customer"?"block":"none";
    if(crm)crm.style.display=m==="crm"?"block":"none";
    q("#customerMode").classList.toggle("on",m==="customer"); q("#crmMode").classList.toggle("on",m==="crm");
    var cnav=q("#mobileCustomerNav"), rnav=q("#mobileCrmNav");
    if(cnav)cnav.style.display=m==="customer"?"grid":"none";
    if(rnav)rnav.style.display=m==="crm"?"grid":"none";
  }

  function openCart(){ q("#overlay").classList.add("on"); q("#cartDrawer").classList.add("on"); }
  function closeCart(){ q("#overlay").classList.remove("on"); q("#cartDrawer").classList.remove("on"); }
  function openMenu(){ var d=q("#mobileDrawer"), b=q("#mobileMenuBackdrop"); if(d)d.classList.add("on"); if(b)b.classList.add("on"); }
  function closeMenu(){ var d=q("#mobileDrawer"), b=q("#mobileMenuBackdrop"); if(d)d.classList.remove("on"); if(b)b.classList.remove("on"); }
  function toast(msg){ var el=q("#toast"); if(!el)return; el.textContent=msg; el.classList.add("on"); clearTimeout(toast.timer); toast.timer=setTimeout(function(){el.classList.remove("on");},1500); }

  document.addEventListener("click",function(e){
    var b=e.target.closest("[data-action],[data-customer-view],[data-crm-view]");
    if(!b)return;
    if(b.hasAttribute("data-customer-view")){ showCustomerView(b.getAttribute("data-customer-view")); return; }
    if(b.hasAttribute("data-crm-view")){ showCrmView(b.getAttribute("data-crm-view")); return; }
    var a=b.getAttribute("data-action"), id=b.getAttribute("data-id");
    if(a==="menu-open")openMenu();
    if(a==="menu-close")closeMenu();
    if(a==="lang-de"){state.lang="de";q("#deBtn").classList.add("on");q("#enBtn").classList.remove("on");renderText();}
    if(a==="lang-en"){state.lang="en";q("#enBtn").classList.add("on");q("#deBtn").classList.remove("on");renderText();}
    if(a==="mode-customer")setMode("customer");
    if(a==="mode-crm"){setMode("crm");closeMenu();}
    if(a==="add-cart")addCart(id);
    if(a==="cart-minus")updateCart(id,-1);
    if(a==="cart-plus")updateCart(id,1);
    if(a==="add-sample")addSample(id);
    if(a==="sample-minus")updateSample(id,-1);
    if(a==="sample-plus")updateSample(id,1);
    if(a==="cart-open")openCart();
    if(a==="cart-close")closeCart();
    if(a==="finder-option"){state.answers[state.finderStep]=b.getAttribute("data-value");renderFinder();}
    if(a==="finder-prev"){if(state.finderStep>0)state.finderStep--;renderFinder();}
    if(a==="finder-next"){if(state.finderStep<4)state.finderStep++;renderFinder();}
    if(a==="auto-toggle"){var k=b.getAttribute("data-auto-switch");state.automations[k]=!state.automations[k];renderCRM();}
    if(a==="auto-run"){var r=b.getAttribute("data-auto-run");var title=tr(r);state.activity.unshift(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})+" · "+title+" · manual");renderCRM();toast(tr("toastAutomation"));}
    if(a==="campaign-open"||a==="campaign-new")toast(tr("toastCampaign"));
    if(a==="customer-open")toast(tr("toastCustomer"));
    if(a==="checkout")toast(tr("checkout"));
  });

  document.addEventListener("DOMContentLoaded",function(){
    renderText(); setMode("customer"); showCustomerView("home"); showCrmView("dashboard");
  });
})();