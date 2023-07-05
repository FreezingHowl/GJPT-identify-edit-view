layui.use(['laytpl', 'dropdown', 'element', 'util', 'table', 'form'], function() {
    let laytpl = layui.laytpl;
    let dropdown = layui.dropdown;
    let element = layui.element;
    let util = layui.util;
    let table = layui.table;
    let form = layui.form;
    let jsonEditorObj; // jsonEditor实例
    let tplJsonData = ""; // 全局JSON对象（上传获得）
    let identifyServers = []; // 属性识别服务列表
    let currentServer = {
        type: null,
        serverInfo: {},
        layers:[]
    }; // 当前操作的服务（右侧服务内容展示数据）
    let resourceUrl; // 获取资源详情的URL
    let mode = "url"; 
    let globalResourceList = []; // 全局资源列表
    
    // 初始化页面  
    initPage();    
    /*
    * 初始化页面
    */
    function initPage () {
        // 初始化工具内容
        initTool();
        // 初始化左侧列表
        initLeftList();
        // 初始化服务数据
        initSercerBox();
        // 初始化JSON编辑器
        initJsonEditor();
    }
    /*
            * 初始化工具内容
            */
    function initTool() {
        // 初始化导入事件
        document.getElementById("input").addEventListener("change", function (response) {
            let file = response.target.files[0];
            const reader = new  FileReader()
            reader.readAsText(file);
            reader.onloadend = function (event) {
				response.target.value = null;
                tplJsonData = JSON.parse(event.srcElement.result);
                
                // 获取属性识别服务数据
                identifyServers = getIdentifyDataByTplData();

                // 判断属性识别服务
                if(identifyServers) {
                    jsonEditorObj.set(tplJsonData);
                } else {
                    layer.msg("请上传TPL模板格式数据！", {icon: 0});
                }
            }
        })

        // 初始化工具事件
        util.on('lay-tool', {
            // 获取字段
            getField: function() {
                let id = this.getAttribute("data-id");
                let index = currentServer.layers.findIndex(e => e.id == id);
                let layer = currentServer.layers[index];
                switch(currentServer.type) {
                    case "ArcGis": {
                        let layerUrl = currentServer.serverInfo.url + "/" + layer.layerId;
                        getServerData(layerUrl + "?f=pjson").then(res => {
                            if(res) {
                                let fileds = res.fields.map(e => {
                                    return {
                                        name: e.name,
                                        alias: e.alias,
                                        id: e.name
                                    }
                                });

                                // 更新图层数据
                                layer.fileds = fileds;
                                currentServer.layers[index] = layer;

                                // 更新字段表格
                                table.reload(id + "-fieldTable", {data: fileds});
                                table.resize(id + "-fieldTable");
                            }
                        })
                        break;
                    }
                    case "SuperMap": {
                        // 获取数据服务（数据服务加数据集获取字段）
                        let dataUrlDom = document.getElementById("dataUrl");
                        let tempDataUrl = dataUrlDom.value;
                        let tempDataSet = layer.dataSet;
                        let splitArray = tempDataSet.split(":");
                        let dataSourceName = splitArray[0];
                        let dataSetName = splitArray[1];
                        let fieldUrl = tempDataUrl + "/datasources/" + dataSourceName + "/datasets/" + dataSetName + "/fields.json";

                        getServerData(fieldUrl).then(res => {
                            if (res) {
                                let fieldNameArray = res.fieldNames;
                                let fileds = fieldNameArray.map(e => {
                                    return {
                                        name: e,
                                        alias: e,
                                        id: e
                                    }
                                })

                                // 更新图层数据
                                layer.fileds = fileds;
                                currentServer.layers[index] = layer;

                                // 更新字段表格
                                table.reload(id + "-fieldTable", {data: fileds});
                                table.resize(id + "-fieldTable");
                            }
                        })

                        break;
                    }
                    default: break;
                }
            },
            // 获取数据服务地址
            getDataUrl: function(event) {
                let dataUrlDom = document.getElementById("dataUrl");
                let urlDom = document.getElementById("url");
                let serverUrl = urlDom.value;
                let sblitByOne = serverUrl.split("/rest");
                let sblitByTwo = sblitByOne[0].split("/map");
                let tempDataUrl = sblitByTwo[0] + "/data" + sblitByTwo[1] + "/rest/data";

                // 测试数据地址是否可访问
                getServerData(tempDataUrl + ".json").then(res => {
                    if(res) {
                        dataUrlDom.value = tempDataUrl;
                        currentServer.serverInfo.dataUrl = tempDataUrl;
                    } else {
                        layer.msg("数据服务地址不存在！", {icon: 0});
                    }
                }).catch(() => {
                    layer.msg("数据服务地址不存在！", {icon: 0});
                })
            }
        });
    }
    /**
     * 从模板数据中获取属性识别数据
     * 
     * @param {*} tplData 
     * @returns 
     */
    function getIdentifyDataByTplData (tplData) {
        if (!tplData) {
            tplData = tplJsonData;
        }
        // 获取服务数组（当没有时返回空数组）
        try{
            let widgets = (tplData.widgets || []).concat(tplData.tools || []);
            let tempIdentifyData = widgets.find(e => e.id === "identify");
            let services = tempIdentifyData.config.services;
            return services;
        } catch {
            return null;
        }
    }
    /**
    * 清除图层TAB页
    */
    function clearLayerTabs() {
        let e = document.getElementsByClassName("layui-tab-title")[0]; 
        let childOfE = e.lastElementChild;  
        while (childOfE) { 
            e.removeChild(childOfE); 
            childOfE = e.lastElementChild; 
        } 
        let f = document.getElementsByClassName("layui-tab-content")[0]; 
        let childOfF = f.lastElementChild;  
        while (childOfF) { 
            f.removeChild(childOfF); 
            childOfF = f.lastElementChild; 
        } 
    }
    /*
    * 初始化左侧列表
    */
    function initLeftList() {
        // 监听获取目录提交事件
        form.on('submit(init-resource-list)', function(data){
            // 判断是否已导入数据
            if(tplJsonData && (tplJsonData !== "")) {
                let field = data.field;
                
                // 获取地址并请求数据（赋值资源接口）
                let catalogUrl = field.catalogApi;
                resourceUrl = field.resourceApi;

                getServerData(catalogUrl).then(res => {
                    if (res) {
                        // 获取所有资源列表
                        let catalogTree = res;
                        let resourceList = getResourceListByCatalogTree(catalogTree.children);

                        // 补充已读标识
                        resourceList = resourceList.map(e => {
                            e.isHaven = identifyServers.map(e => e.serverid).includes(e.value);
                            return e;
                        })
                        globalResourceList = resourceList;
                        
                        // 渲染资源列表
                        runderLeftList(resourceList);
                    }
                }).catch(()=> {
                    layer.msg("获取资源资源列表失败！", {icon: 0});
                })
            } else {
                layer.msg("请先导入TPL文件模板！", {icon: 0});
            }

             // 阻止默认 form 跳转
            return false;
        });

        // 菜单点击事件
        dropdown.on('click(resourceList)', function(options){          
            // 重置当前服务
            currentServer = {
                type: null,
                serverInfo: {},
                layers:[]
            };
            // 获取服务详细数据
            let resourceId = options.resourceId;
            currentServer.serverInfo.serverid = resourceId;
            let tempUrl = resourceUrl + "?id=" + resourceId;
            getServerData(tempUrl).then(res => {
                if (res) {
                    if(mode === "url") {
                        buildServerDataOfUrl(res);
                    } else {
                        buildServerDataOfDetail(res);
                    }
                }
            }).catch(() => {
                layer.msg("ID为【" + resourceId + "】的资源数据获取失败！", {icon: 0});
                console.log("ID为【" + resourceId + "】的资源数据获取失败！")
            })
        });
    }
    /**
     * get请求获取服务数据
     * 
     * @param {*} url 
     * @returns 
     */
    function getServerData(url) {
        return new Promise(function(resolve, reject) {
            $.ajax({
                url: url,
                success: function(response){
                    if (response) {
                        resolve(response);
                    }
                },
                dataType: "json",
                error: function() {
                    reject();
                }
            });
        })
    }

    /**
     * 渲染左侧列表
     * @param {*} data 
     */
    function runderLeftList(data) {
        let templateHtml = document.getElementById("resourceList-template").innerHTML;
        let renderDom = document.getElementById("resourceList");
        laytpl(templateHtml).render(data, function(html){
            renderDom.innerHTML = html;
        });
    }

    /**
     * 根据服务地址构建数据
     * @param {*} response 
     */
    function buildServerDataOfUrl(response) {
        let tempServerData = response[0];
        let resourceType = tempServerData.type; 
        let url = tempServerData.url;
        // 构建服务信息
        currentServer.serverInfo.title = tempServerData.title;
        currentServer.serverInfo.url = tempServerData.url;
        // 构建当前服务渲数据
        switch(resourceType) {
            case "sp_ags_rest":
            case "ags_tile":
            case "ags_rest": {
            // 设置类型
            currentServer.type = "ArcGis";
            
            // 判断地址是否到图层一级(是的话修改到服务一级)
            if (url.split("MapServer/")[1]) {
                url = url.split("MapServer/")[0] + "MapServer";
                currentServer.serverInfo.url = url;
            }
            // 获取服务信息
            getServerData(url + "?f=pjson").then(response => {
                if(response && !response.error) {
                    let layers = response.layers;
                    
                    // 构建图层数据
                    for(let i = 0; i < layers.length; i++) {
                        let perLayer = layers[i];

                        // 如果属性识别列表中已存在时，使用属性识别列表中的数据
                        let tempIdentifyData = getIdentifyServerByCurrentServer(perLayer.id);

                        // 补充url和dataUrl
                        if(tempIdentifyData) {
                            currentServer.serverInfo.url = tempIdentifyData.realUrl && tempIdentifyData.realUrl !== "" ?  tempIdentifyData.realUrl : currentServer.serverInfo.url;
                        }

                        currentServer.layers.push({
                            layerId: tempIdentifyData ? tempIdentifyData.layerid : perLayer.id,
                            layerName: perLayer.name,
                            fileds: tempIdentifyData ? tempIdentifyData.fileds.map(e => { return{name: e, alias: e, id: e}}) : [],
                            id: tempIdentifyData ? tempIdentifyData.layerid : perLayer.id
                        })
                    }
                    // 渲染右侧服务信息
                    initSercerBox();
                } else {
                    layer.msg("服务地址为【" + url + "】的资源获取服务数据错误！", {icon: 0});
                    console.log(url);
                }
            })
            break;
            }
            case "spm_tile":
            case "spm_rest": {
                currentServer.type = "SuperMap";

                // 获取服务信息
                getServerData(url + "/layers.json").then(response => {
                    if(response && !response.error) {
                        for (let i = 0; i < response.length; i++) {
                            let layer = response[i];
                            let layerChild = layer.subLayers.layers[0];
                            let datasetInfo = layerChild.datasetInfo;
                            let dataSet = datasetInfo.dataSourceName + ":" + datasetInfo.name;
                            let id = datasetInfo.dataSourceName + "-" + datasetInfo.name;

                            // 如果属性识别列表中已存在时，使用属性识别列表中的数据
                            let tempIdentifyData = getIdentifyServerByCurrentServer(layer.id);

                            // 补充url和dataUrl
                            if(tempIdentifyData) {
                                currentServer.serverInfo.url = tempIdentifyData.realUrl && tempIdentifyData.realUrl !== "" ?  tempIdentifyData.realUrl : currentServer.serverInfo.url;
                                currentServer.serverInfo.dataUrl = tempIdentifyData.dataUrl && tempIdentifyData.dataUrl !== "" ?  tempIdentifyData.dataUrl : currentServer.serverInfo.dataUrl;
                            }

                            currentServer.layers.push({
                                dataSet: tempIdentifyData ? tempIdentifyData.datasetName : dataSet,
                                layerName: layer.name,
                                fileds: tempIdentifyData ? tempIdentifyData.fileds.map(e => { return{name: e, alias: e, id: e}}) : [],
                                id: id
                            })
                        }
                        // 渲染右侧服务信息
                        initSercerBox();
                    } else {
                        layer.msg("服务地址为【" + url + "】的资源获取服务数据错误！", {icon: 0});
                        console.log(url);
                    }
                }).catch(()=> {
                    layer.msg("服务地址为【" + url + "】的资源获取服务数据错误！", {icon: 0});
                })
                break
            }
            default: {
                layer.msg("服务类型为【" + resourceType + "】的资源暂不支持配置！", {icon: 0});
            break;
            }
        }
    }

    /**
     * 根据当前服务获取属性识别数据
     * 
     * @param {*} layerMarkValue 
     * @returns 
     */
    function getIdentifyServerByCurrentServer(layerMarkValue) {
        if(identifyServers.length === 0) {
            return null;
        }

        let returnServer = null;
        for(let i = 0; i < identifyServers.length; i++) {
            let server = identifyServers[i];
            let tempKey = currentServer.type === "ArcGis" ? "layerid" : "datasetName";

            if(server.serverid === currentServer.serverInfo.serverid && server[tempKey] === layerMarkValue) {
                returnServer = server;
            }
        }

        return returnServer;
    }

    /**
     * 根据资源详情构建数据
     * @param {*} response 
     */
    function buildServerDataOfDetail(response) {
        let tempServerData = response[0];
        let resourceType = tempServerData.type; 
        let tempLayers = tempServerData.resourceView.capables[0].info.layers;
        
        // 构建当前服务渲数据
        switch(resourceType) {
            case "sp_ags_rest":
            case "ags_tile":
            case "ags_rest": {
                currentServer.type = "ArcGis";
                if (tempServerData.url.split("MapServer/")[1]) {
                    layer.msg("服务地址错误！", {icon: 0});
                    console.log(tempServerData.url);
                } else {
                    currentServer.serverInfo.title = tempServerData.title;
                    currentServer.serverInfo.url = tempServerData.url;
                    for(let i = 0; i < tempLayers.length; i++) {
                        let perLayer = tempLayers[i];
                        currentServer.layers.push({
                            layerId: perLayer.id,
                            layerName: perLayer.name,
                            fileds: [],
                            id: perLayer.id
                        })
                    }
                }
                break;
            }
            case "spm_tile":
            case "spm_rest": {
                currentServer.type = "SuperMap";
                currentServer.serverInfo.title = tempServerData.title;
                currentServer.serverInfo.url = tempServerData.url;
                currentServer.serverInfo.dataUrl = "";
                for(let i = 0; i < tempLayers.length; i++) {
                    let perLayer = tempLayers[i];
                    currentServer.layers.push({
                        dataSet: perLayer.datasetInfo.dataSourceName + ":" + perLayer.datasetInfo.name,
                        layerName: perLayer.name,
                        fileds: [] ,
                        id: i
                    })
                }
                break
            }
            default: {
                layer.msg("服务类型为【" + resourceType + "】的资源暂不支持配置！", {icon: 0});
                break;
            }
        }
    }
   /**
    * 迭代获取资源列表
    * @param {*} catalogTree 
    * @returns 
    */
    function getResourceListByCatalogTree (catalogTree) {
        let resourceList = [];
        for (let i = 0; i < catalogTree.length; i++) {
            let per = catalogTree[i];
            if (per.type === "resource") {
                resourceList.push(per);    
            }
            if (per.children && per.children.length > 0) {
                resourceList = resourceList.concat(getResourceListByCatalogTree(per.children));
            }
        }
        return resourceList;
    }
    /*
    * 初始化服务数据
    */
    function initSercerBox() {
        // 渲染服务信息
        let templateHtml = document.getElementById("serverForm-template").innerHTML;
        let serverFormDom = document.getElementById("serverForm");
        laytpl(templateHtml).render(currentServer, function(html) {
            serverFormDom.innerHTML = html;
        })
        // 渲染图层
        clearLayerTabs();
        let layers = currentServer.layers;
        for(let i = 0; i < layers.length; i++) {
            let layer = layers[i];
            let fileds = layer.fileds;
            let contentHtml;
            let templateHtml = document.getElementById("layerData-template").innerHTML;
            laytpl(templateHtml).render(layer, function (html) {
                contentHtml = html;
            });
            element.tabAdd('layer-handle', {
                title: layer.layerName,
                content: contentHtml,
                id: layer.id,
                change: true
            });

            // 渲染表格
            table.render({
                elem: '#' + layer.id + "-fieldTable",
                editTrigger: 'dblclick',
                css: ['.layui-table-view td[data-edit]{color: #16B777;}'].join(''),
                cols: [[
                    {field:'name', title: '字段名称', width:150, edit: "editable"},
                    {field:'alias', title: '别名名称', edit: "editable"},
                    { title:'操作', width:150, toolbar: '#tableBar-template'}
                ]],
                scrollPos: "fixed",
                data: fileds,
                height: 180
            });
              // 单元格编辑后的事件
            table.on('edit(' + layer.id + "-fieldTable)" , function(obj) {
                let field = obj.field; // 得到修改的字段
                let value = obj.value // 得到修改后的值
                let oldValue = obj.oldValue // 得到修改前的值 -- v2.8.0 新增
            
                // 值的校验
                if(field === "name" && value.replace(/\s/g, '') === ''){
                    layui.layer.msg("字段名不可为空！", {icon: 0});
                    return obj.reedit(); // 重新编辑 -- v2.8.0 新增
                }
            });

            table.on('tool(' + layer.id + "-fieldTable)", function(obj){
                let data = obj.data;
                let layerIndex = currentServer.layers.findIndex(e => e.id == layer.id);
                let tempLayer = currentServer.layers[layerIndex];

                switch(obj.event){
                    case 'add':
                        tempLayer.fileds.push({
                            name: "",
                            alias: "",
                            id: _.uniqueId("field_")
                        });
                        break;
                    case 'remove':
                        tempLayer.fileds = tempLayer.fileds.filter(e => e.id !== data.id);
                        break;
                    default: break
                };
                currentServer.layers[layerIndex] = tempLayer;

                table.reload(layer.id + "-fieldTable" , {data: tempLayer.fileds});
            });
        }
        
        // 监听添加事件
        form.on('submit(saveIndentify)', function(data){
            // 构建识别数据
            let field = data.field;
            let identifyDataList = [];
            let emptyIdentifyDataOfArcGis = {
                "serverid": "",
                "layerid": "",
                "fileds": [],
                "isIdentify": true,
                "buttons": [],
                "realUrl": "",
                "popup": "",
                "dictionary": []
            }
            let emptyIdentifyDataOfSuperMap = {
                "serverid": "",
                "dataSet": "",
                "fileds": [],
                "realUrl": "",
                "dataUrl": "",
                "isIdentify": true,
                "buttons": [],
                "popup": "",
                "dictionary": []
            }
            switch(currentServer.type) {
                case "ArcGis": {
                    for (let i = 0; i < currentServer.layers.length; i++) {
                        let layerInfo = currentServer.layers[i];
                        let tempIdentifyData = _.cloneDeep(emptyIdentifyDataOfArcGis);
                        tempIdentifyData.serverid = currentServer.serverInfo.serverid;
                        tempIdentifyData.realUrl = currentServer.serverInfo.url;
                        tempIdentifyData.layerid = layerInfo.layerId;
                        tempIdentifyData.fileds = layerInfo.fileds.map(e => e.name);

                        identifyDataList.push(tempIdentifyData);
                    }
                    break;
                }
                case "SuperMap": {
                    for (let i = 0; i < currentServer.layers.length; i++) {
                        let layerInfo = currentServer.layers[i];
                        let tempIdentifyData = _.cloneDeep(emptyIdentifyDataOfSuperMap);
                        tempIdentifyData.serverid = currentServer.serverInfo.serverid;
                        tempIdentifyData.realUrl = currentServer.serverInfo.url;
                        tempIdentifyData.dataUrl = currentServer.serverInfo.dataUrl;
                        tempIdentifyData.dataSet = layerInfo.layerId;
                        tempIdentifyData.fileds = layerInfo.fileds.map(e => e.name);

                        identifyDataList.push(tempIdentifyData);
                    }
                    break;
                }
                default: break;
            }
            // 更新JSON数据
            let oledJson = jsonEditorObj.get();
            let where = getWhereOfIdentify(oledJson);
            if(where) {     
                // 构建属性识别服务列表
                buildIdentifyServerList(identifyDataList);
                
                // 更新TPL数据
                let widgets = oledJson[where];
                let identifyIndex = widgets.findIndex(e => e.id === "identify");
                widgets[identifyIndex].config.services = identifyServers;
                oledJson[where] = widgets;
                jsonEditorObj.set(oledJson);

                // 更新左侧列表
                updateLeftListByIdentifyServers();

                layer.msg("配置添加成功！", {icon: 0});
            } else {
                layer.msg("未获取到属性识别配置！", {icon: 0});
            }
             // 阻止默认 form 跳转
            return false;
        });
    }
    /**
     * 获取属性识别在哪里
     * 
     * @param {*} json 
     * @returns 
     */
    function getWhereOfIdentify(json) {
        let widgets = json.widgets;
        let tools = json.tools;
        let identifyIndexOfWidgets = widgets.findIndex(e => e.id === "identify");
        let identifyIndexOfTools = tools.findIndex(e => e.id === "identify");

        if(identifyIndexOfWidgets !== -1) {
            return "widgets";
        } else if (identifyIndexOfTools !== -1){
            return "tools";
        } else {
            return null;
        }
    }

    /**
     * 构建属性识别服务列表（保留新增数据，替换已有数据）
     * @param {*} layerList 
     */
    function buildIdentifyServerList(layerList) {
        let unIncludeArray = [];
        for(let i = 0; i < layerList.length; i++ ) {
            let layer = layerList[i];
            let layerExtraParam = layer.datasetName || layer.layerid;

            let unInclude = true;
            for(let j = 0; j < identifyServers.length; j++) {
                let identify = identifyServers[j];
                let identifyExtraParam = identify.datasetName || identify.layerid;

                if(layer.serverid === identify.serverid && layerExtraParam === identifyExtraParam) {
                    identifyServers[j] = layer;
                    unInclude = false;
                }
            }

            if(unInclude) {
                unIncludeArray.push(layer);
            }
        }
        identifyServers = identifyServers.concat(unIncludeArray);
    }

    /**
     * 更新左侧列表
     */
    function updateLeftListByIdentifyServers() {
        globalResourceList.forEach(resource => {
            resource.isHaven = identifyServers.findIndex(e => e.serverid === resource.value) !== -1;
        })

        runderLeftList(globalResourceList);
    }
    /**
     * 获取目标数组在对比数组中不存在的数组列表
     * 
     * @param {*} targetArray 
     * @param {*} compareArray 
     */
    function getDifferentInclude(targetArray, compareArray) {
        let differentArray = [];
        for (let i = 0; i < targetArray.length; i++) {
            let target = targetArray[i];
            let serverid = target.serverid;
            let extraStr = target.dataSetName || target.layerId;
            let isSame = false;
            for (let j = 0; j < compareArray.length; j++) {
                let compare = compareArray[j];
                let tempServerid = compare.serverid;
                let tempExtraStr = compare.dataSetName || compare.layerId;
                if (serverid === tempServerid && extraStr === tempExtraStr) {
                    isSame = true;
                }
            }
            if(!isSame) {
                differentArray.push(target);
            }
        }
        return differentArray;
    }
    /*
    * 初始化JSON编辑器
    */
    function initJsonEditor() {
        let container = document.getElementById("tplJson");
        let options = {
            mode: "code", // 编辑器模式
            onError: function (error) {
                console.log(error);
            }, // 错误回调
            sortObjectKeys: false, // 通过字段进行排序（不按照插入时顺序）
            limitDragging: false, // 限制拖拽（只能在本父级内拖拽）
            history: true, // 开启历史记录（出现前进和后退按钮）
            name: "Object", // 根节点的初始字段名称
            search: true, // 启用搜索
            indentation: 2, // 缩进字节数
            mainMenuBar: true, // 开启主菜单
            navigationBar: true, // 开启导航栏
            statusBar: true, // 开启字节计数器
            language: "zh-CN", // 翻译语言
            enableSort: true, // 启用排序功能
            onChangeText: function (val){
				tplJsonData = JSON.parse(val);
			}			
        }
        let tempJsonData = tplJsonData;
        jsonEditorObj = new JSONEditor(container, options, tempJsonData);
    }
});