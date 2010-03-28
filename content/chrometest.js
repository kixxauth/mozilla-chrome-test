
var CT = (function () {
  var app = {}, MOZID = "chrometest@fireworksproject.com",

      ext_dir = Components.classes["@mozilla.org/extensions/manager;1"]
            .getService(Components.interfaces.nsIExtensionManager)
            .getInstallLocation(MOZID)
            .getItemLocation(MOZID),
            
      content_dir = ext_dir.clone(),
      
      resource_dir = ext_dir.clone();

      content_dir.append("content");
      resource_dir.append("resources");

  function is_perm_file(name) {
    return (name === "content" ||
            name === "resources" ||
            name === "chrometest.html" ||
            name === "chrometest.js" ||
            name === "README.md");
  }

  function download_simplefetch(url, target, aOnProgress, aOnComplete) {
    var uri = Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService)
                  .newURI(url, null, null);
    
    var nsIWBP = Components.interfaces.nsIWebBrowserPersist;
    var persist = Components.
      classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
      createInstance(nsIWBP);
    persist.persistFlags = nsIWBP.PERSIST_FLAGS_BYPASS_CACHE |
                           nsIWBP.PERSIST_FLAGS_NO_CONVERSION |
                           nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                           nsIWBP.PERSIST_FLAGS_CLEANUP_ON_FAILURE;

    persist.progressListener =
    {
      onProgressChange: function onProgressChange(aWebProgress,
                            aRequest,
                            aCurSelfProgress,
                            aMaxSelfProgress,
                            aCurTotalProgress,
                            aMaxTotalProgress)
      {
        /*
        kdump(aWebProgress +", "+
              aRequest +", "+
              aCurSelfProgress +", "+
              aMaxSelfProgress +", "+
              aCurTotalProgress +", "+
              aMaxTotalProgress);
              */

        if(aMaxSelfProgress == -1)
          aOnProgress(-1);

        else if(aCurSelfProgress > 0)
          aOnProgress((aCurSelfProgress / aMaxSelfProgress) * 100);

        return true;
      },

      onStatusChange: function onStatusChange(aWebProgress, aRequest, aStatus, aMessage)
      {
        //kdump(aWebProgress +", "+ aRequest +", "+
         //     aStatus +", "+ aMessage);
        // no operation
        return true;
      },

      onStateChange: function onStateChange(aWebProgress, aRequest, aState, aStatus)
      {
        //kdump(""+ aWebProgress +", "+ aRequest.isPending() +", "+ aStatus +", "+ aStatus);

        if(!aRequest.isPending())
          aOnComplete(target);
        return true;
      }
    };

    // do the save
    persist.saveURI(uri, null, null, null, "", target);
  }

  function download(loc, target) {
    try {
      download_simplefetch(loc, target,
          function (p) {},
          function (file) {
            update_listing();
          });
    } catch(e) {
      Components.utils.reportError(e);
      alert(e);
    }
  }

  function dir_contents(file) {
    if(!(file instanceof Components.interfaces.nsIFile)) {
      throw new Error(
          "file.contents() expects a file object as the single parameter");
    }
    if(!file.isDirectory)
      throw new Error("file.contents() expects a directory file object");

    var entries = file.directoryEntries;
    var list = [];

    while(entries.hasMoreElements())
    {
      var file = entries.getNext();
      file.QueryInterface(Components.interfaces.nsIFile);
      list.push(file);
    }

    // todo: how cool would it be to return an iterator instead???
    return list;
  }

  function getCurrentWindow() {
    return Components.classes["@mozilla.org/appshell/window-mediator;1"]  
               .getService(Components.interfaces.nsIWindowMediator)
               .getMostRecentWindow("navigator:browser");  
  }

  function openNewTab(url) {
    var browser = getCurrentWindow().gBrowser,
        tab = browser.addTab(url);

    browser.selectedTab = tab;
    return browser.getBrowserForTab(tab).contentWindow;
  }


  function make_row(file, url, padding) {
    var row = document.createElement("tr"),
        label = document.createElement("td"),
        del = document.createElement("td");

    row.setAttribute("class", "file-row");
    label.setAttribute("class", "clickme");
    label.setAttribute("style", "padding-left:"+ padding +"em;");
    label.innerHTML = '<span>'+ file.leafName +'</span>';
    label.setAttribute("onclick", "CT.open_file('"+ url +"');");

    if (!is_perm_file(file.leafName)) {
      del.setAttribute("class", "clickme");
      del.innerHTML = '<span>delete</span>';
      del.setAttribute("onclick", "CT.remove_file('"+ file.path +"');");
    }

    row.appendChild(label);
    row.appendChild(del);
    return row;
  }

  function make_list(/* directories */) {
    var i = 0, file, proto, dir,
        table = document.createElement("table");

    table.setAttribute("id", "file-list");

    function show_dir(dir, url, padding) {
      padding = padding || 3;
      table.appendChild(make_row(dir, url, padding));
      padding += 2;

      dir_contents(dir).forEach(function (entry) {
            if (entry.isDirectory()) {
              arguments.callee(entry, (url + entry.leafName + "/"), padding);
            }
            else {
              table.appendChild(
                make_row(entry, (url + entry.leafName), padding));
            }
          });
    }

    for (; i < arguments.length; i += 1) {
      file = arguments[i][1];
      proto = arguments[i][0];
      show_dir(file, proto +"://chrometest/"+ file.leafName +"/");
    }

    document.getElementById("installed-items")
      .replaceChild(table, document.getElementById("file-list"));
  }

  function update_listing() {
    make_list(["chrome", content_dir], ["resource", resource_dir]);
  }

  app.init = function init(load_event) {
    window.removeEventListener("load", app.init, false);
    update_listing();
  };

  app.open_file = function open_file(loc) {
    openNewTab(loc);
  };

  app.remove_file = function remove_file(path) {
    var file = Components.classes["@mozilla.org/file/local;1"].
                         createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(path);
    file.remove(false);
    update_listing();
  };

  app.install_content = function install_content(loc, target_name) {
    var target = content_dir.clone();
    target_name = target_name || "default";

    try {
      target.append(target_name);
      download(loc, target);
    } catch(e) {
      Components.utils.reportError(e);
      alert(e);
    }
  };

  app.install_resource = function install_resource(loc, target_name) {
    var target = resource_dir.clone();
    target_name = target_name || "default";

    try {
      target.append(target_name);
      download(loc, target);
    } catch(e) {
      Components.utils.reportError(e);
      alert(e);
    }
  };

  return app;
}());

window.addEventListener("load", CT.init, false);

