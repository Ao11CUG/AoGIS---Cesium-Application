<template>
  <div class="layout-container">
    <!-- 左侧边栏 -->
    <div class="sidebar">
      <div class="sidebar-content">
        <h2>AoGIS</h2>
        <!-- 设施寻路面板 -->
        <div class="facility-panel">
          <h3>设施寻路</h3>
          <label style="color: blue">[请先切换至高德地图]</label>
          <div class="param-item">
            <label>设施名称</label>
            <input 
              type="text" 
              v-model="facilityParams.facilityName" 
              class="facility-input"
              placeholder="输入设施名称（如：医院、诊所）"
              :disabled="isSearching"
            >
          </div>
          <div class="param-item">
            <label>查找数量</label>
            <input 
              type="number" 
              v-model.number="facilityParams.count" 
              min="1" 
              max="10" 
              class="facility-input"
              :disabled="isSearching"
            >
          </div>
          <div class="param-item">
            <label>起点坐标</label>
            <div v-if="facilityParams.startLat && facilityParams.startLon" class="coordinate-display">
              经度: {{ facilityParams.startLon.toFixed(6) }}°
              纬度: {{ facilityParams.startLat.toFixed(6) }}°
            </div>
            <button 
              class="pick-location-btn" 
              @click="startLocationPicking"
              :disabled="isSearching"
            >
              点击选择起点
            </button>
          </div>
          <div class="param-item">
            <button 
              class="search-btn" 
              @click="startFacilitySearch"
              :disabled="!facilityParams.facilityName || !facilityParams.count || !facilityParams.startLat || !facilityParams.startLon || isSearching"
            >
              <span v-if="!isSearching">开始寻找</span>
              <span v-else class="loading-text">
                <span class="loading-dots"></span>
                搜索中
              </span>
            </button>
          </div>

          <!-- 添加清除按钮 -->
          <div class="param-item">
            <button 
              class="clear-btn" 
              @click="clearFacilitySearch"
            >
              清除结果
            </button>
          </div>

          <!-- 搜索结果显示 -->
          <div v-if="facilityResults.length > 0" class="facility-results">
            <h4>搜索结果</h4>
            <div class="result-list">
              <div v-for="(facility, index) in facilityResults" :key="index" class="result-item">
                <div class="result-header">
                  <span class="facility-name">{{ facility.name }}</span>
                </div>
                <div class="result-info">
                  <div class="info-row" v-if="facility.walkingDistance">
                    <i class="info-icon">📍</i>
                    <span>{{ facility.walkingDistance }}</span>
                  </div>
                  <div class="info-row" v-else>
                    <i class="info-icon">📍</i>
                    <span>距离: {{ (facility.distance / 1000).toFixed(2) }}公里</span>
                  </div>
                  <div class="info-row" v-if="facility.address">
                    <i class="info-icon">🏢</i>
                    <span>{{ facility.address }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 顶部栏 -->
    <div class="top-bar">
      <!-- 顶部按钮组 -->
      <div class="top-buttons">
        <button class="top-button" @click="toggleDrawer('imagery')">
          <span class="icon">🛰️</span>
          <span class="text">影像图层</span>
        </button>
        <button class="top-button" @click="toggleDrawer('terrain')">
          <span class="icon">⛰️</span>
          <span class="text">地形</span>
        </button>
        <button class="top-button" @click="toggleDrawer('data')">
          <span class="icon">📊</span>
          <span class="text">数据加载</span>
        </button>
        <button class="top-button" @click="toggleDrawer('analysis')">
          <span class="icon">📐</span>
          <span class="text">空间分析</span>
        </button>
      </div>

      <!-- 影像图层悬浮窗 -->
      <div class="floating-window" v-show="isImageryOpen" :style="{ left: imageryPosition.x + 'px', top: imageryPosition.y + 'px' }">
        <div class="window-header" @mousedown="startDrag($event, 'imagery')">
          <div class="drag-handle">
            <span class="drag-icon">⋮⋮</span>
            <span class="drag-text">拖动</span>
          </div>
          <span class="window-title">影像图层</span>
          <button class="close-button" @click="toggleDrawer('imagery')">×</button>
        </div>
        <div class="window-content">
          <div class="control-group">
            <button 
              class="control-button" 
              @click="$emit('switch-imagery', 'default')"
              :class="{ active: currentImagery === 'default' }"
            >
              <span class="icon">🛰️</span>
              <span class="text">Cesium</span>
            </button>
            <button 
              class="control-button" 
              @click="$emit('switch-imagery', 'arcgis')"
              :class="{ active: currentImagery === 'arcgis' }"
            >
              <span class="icon">🗺️</span>
              <span class="text">ArcGIS</span>
            </button>
            <button 
              class="control-button" 
              @click="$emit('switch-imagery', 'tianditu')"
              :class="{ active: currentImagery === 'tianditu' }"
            >
              <span class="icon">🌏</span>
              <span class="text">天地图</span>
            </button>
            <button 
              class="control-button" 
              @click="$emit('switch-imagery', 'amap')"
              :class="{ active: currentImagery === 'amap' }"
            >
              <span class="icon">🗺️</span>
              <span class="text">高德地图</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 地形悬浮窗 -->
      <div class="floating-window" v-show="isTerrainOpen" :style="{ left: terrainPosition.x + 'px', top: terrainPosition.y + 'px' }">
        <div class="window-header" @mousedown="startDrag($event, 'terrain')">
          <div class="drag-handle">
            <span class="drag-icon">⋮⋮</span>
            <span class="drag-text">拖动</span>
          </div>
          <span class="window-title">地形</span>
          <button class="close-button" @click="toggleDrawer('terrain')">×</button>
        </div>
        <div class="window-content">
          <button class="drawer-button" @click="$emit('switch-terrain', 'world')">
            <span class="icon">⛰️</span>
            <span class="text">世界地形</span>
          </button>
          <button class="drawer-button" @click="$emit('switch-terrain', 'ellipsoid')">
            <span class="icon">🌐</span>
            <span class="text">椭球体</span>
          </button>
          <button class="drawer-button" @click="$emit('switch-terrain', 'none')">
            <span class="icon">⬜</span>
            <span class="text">无地形</span>
          </button>
        </div>
      </div>

      <!-- 数据加载悬浮窗 -->
      <div class="floating-window" v-show="isDataOpen" :style="{ left: dataPosition.x + 'px', top: dataPosition.y + 'px' }">
        <div class="window-header" @mousedown="startDrag($event, 'data')">
          <div class="drag-handle">
            <span class="drag-icon">⋮⋮</span>
            <span class="drag-text">拖动</span>
          </div>
          <span class="window-title">数据加载</span>
          <button class="close-button" @click="toggleDrawer('data')">×</button>
        </div>
        <div class="window-content">
          <div class="data-load-group">
            <div class="input-group">
              <input type="number" v-model="assetId" placeholder="输入Asset ID" class="asset-input">
              <button class="drawer-button" @click="handle3DTilesLoad">
                <span class="icon">📥</span>
              </button>
            </div>
            <div class="input-group">
              <select v-model="selectedTileset" class="model-select">
                <option value="">选择3D Tiles模型</option>
                <option v-for="(tileset, index) in tilesOptions" :key="index" :value="tileset.path">
                  {{ tileset.name }}
                </option>
              </select>
              <button class="drawer-button" @click="handleTilesetLoad">
                <span class="icon">📥</span>
              </button>
            </div>
            <button class="drawer-button" @click="handle3DTilesClear">
              <span class="icon">🗑️</span>
              <span class="text">清除3D Tiles</span>
            </button>
          </div>
          <div class="data-load-group">
            <input type="file" accept=".geojson,.json" @change="handleGeoJSONFile" class="file-input">
            <div class="geojson-style-panel" v-if="currentGeoJSONFile">
              
              <!-- 颜色设置 -->
              <div class="style-section">
                <h5>分色渲染</h5>
                <div class="color-setting" v-for="(color, type) in colorSettings" :key="type">
                  <label>{{type}}:</label>
                  <input type="color" v-model="color.value" @change="handleStyleChange">
                  <input type="number" v-model="color.alpha" min="0" max="1" step="0.1" @change="handleStyleChange">
                </div>
              </div>

              <!-- 高度设置 -->
              <div class="style-section">
                <h5>高度设置</h5>
                <div class="height-setting">
                  <label>基础高度:</label>
                  <input type="number" v-model.number="heightSettings.baseHeight" @change="handleStyleChange">
                </div>
                <div class="height-setting">
                  <label>高度系数:</label>
                  <input type="number" v-model.number="heightSettings.heightScale" @change="handleStyleChange">
                </div>
              </div>
            </div>
            <button class="drawer-button" @click="handleGeoJSONClear">
              <span class="icon">🗑️</span>
              <span class="text">清除GeoJSON</span>
            </button>
          </div>
          <div class="data-load-group">
            <div class="input-group">
              <select v-model="selectedModel" class="model-select">
                <option value="">选择模型</option>
                <option v-for="(model, index) in modelOptions" :key="index" :value="model.path">
                  {{ model.name }}
                </option>
              </select>
              <button class="drawer-button" @click="handleModelLoad">
                <span class="icon">📥</span>
              </button>
            </div>
            <div v-if="selectedModel" class="model-properties">
              <div class="property-group">
                <label>位置</label>
                <div class="property-inputs">
                  <input type="number" v-model.number="modelProperties.longitude" step="0.000001" placeholder="经度">
                  <input type="number" v-model.number="modelProperties.latitude" step="0.000001" placeholder="纬度">
                  <input type="number" v-model.number="modelProperties.height" step="1" placeholder="高度">
                </div>
              </div>
              <div class="property-group">
                <label>旋转角度</label>
                <div class="property-inputs">
                  <input type="number" v-model.number="modelProperties.heading" step="1" placeholder="航向角">
                  <input type="number" v-model.number="modelProperties.pitch" step="1" placeholder="俯仰角">
                  <input type="number" v-model.number="modelProperties.roll" step="1" placeholder="翻滚角">
                </div>
              </div>
              <div class="property-group">
                <label>缩放</label>
                <input type="number" v-model.number="modelProperties.scale" step="0.1" min="0.1" max="100" placeholder="缩放比例">
              </div>
            </div>
            <button class="drawer-button" @click="handleGITFClear">
              <span class="icon">🗑️</span>
              <span class="text">清除GLTF</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 空间分析悬浮窗 -->
      <div class="floating-window" v-show="isAnalysisOpen" :style="{ left: analysisPosition.x + 'px', top: analysisPosition.y + 'px' }">
        <div class="window-header" @mousedown="startDrag($event, 'analysis')">
          <div class="drag-handle">
            <span class="drag-icon">⋮⋮</span>
            <span class="drag-text">拖动</span>
          </div>
          <span class="window-title">空间分析</span>
          <button class="close-button" @click="toggleDrawer('analysis')">×</button>
        </div>
        <div class="window-content">
          <div class="analysis-group">
            <button class="drawer-button" @click="startAnalysis('path')">
              <span class="icon">🛣️</span>
              <span class="text">路径规划</span>
            </button>
            <button class="drawer-button" @click="startAnalysis('visibility')">
              <span class="icon">👁️</span>
              <span class="text">通视分析</span>
            </button>
            <button class="drawer-button" @click="startAnalysis('viewshed')">
              <span class="icon">🔭</span>
              <span class="text">可视域分析</span>
            </button>
            <button class="drawer-button" @click="startAnalysis('buffer')">
              <span class="icon">⭕</span>
              <span class="text">缓冲区分析</span>
            </button>
          </div>
          <!-- 分析参数设置面板 -->
          <div class="analysis-params" v-if="currentAnalysis">
            <!-- 路径规划参数 -->
            <div v-if="currentAnalysis === 'path'" class="param-group">
              <div class="param-header">
                <h4>路径规划参数</h4>
                <button class="clear-button" @click="$emit('clear-analysis')">清除分析</button>
              </div>
              <div class="param-item">
                <label>起点坐标</label>
                <input type="number" v-model.number="pathParams.startLon" step="0.000001" placeholder="起点经度">
                <input type="number" v-model.number="pathParams.startLat" step="0.000001" placeholder="起点纬度">
              </div>
              <div class="param-item">
                <label>终点坐标</label>
                <input type="number" v-model.number="pathParams.endLon" step="0.000001" placeholder="终点经度">
                <input type="number" v-model.number="pathParams.endLat" step="0.000001" placeholder="终点纬度">
              </div>
              <button class="analysis-button" @click="runPathAnalysis">开始分析</button>
            </div>

            <!-- 通视分析参数 -->
            <div v-if="currentAnalysis === 'visibility'" class="param-group">
              <div class="param-header">
                <h4>通视分析参数</h4>
                <button class="clear-button" @click="$emit('clear-analysis')">清除分析</button>
              </div>
              <div class="param-item">
                <label>观察点坐标</label>
                <input type="number" v-model.number="visibilityParams.observerLon" step="0.000001" placeholder="观察点经度">
                <input type="number" v-model.number="visibilityParams.observerLat" step="0.000001" placeholder="观察点纬度">
                <input type="number" v-model.number="visibilityParams.observerHeight" step="1" placeholder="观察点高度">
              </div>
              <div class="param-item">
                <label>目标点坐标</label>
                <input type="number" v-model.number="visibilityParams.targetLon" step="0.000001" placeholder="目标点经度">
                <input type="number" v-model.number="visibilityParams.targetLat" step="0.000001" placeholder="目标点纬度">
                <input type="number" v-model.number="visibilityParams.targetHeight" step="1" placeholder="目标点高度">
              </div>
              <button class="analysis-button" @click="runVisibilityAnalysis">开始分析</button>
            </div>

            <!-- 可视域分析参数 -->
            <div v-if="currentAnalysis === 'viewshed'" class="param-group">
              <div class="param-header">
                <h4>可视域分析参数</h4>
                <button class="clear-button" @click="$emit('clear-analysis')">清除分析</button>
              </div>
              <div class="param-item">
                <label>视点坐标</label>
                <input type="number" v-model.number="viewshedParams.viewerLon" step="0.000001" placeholder="视点经度">
                <input type="number" v-model.number="viewshedParams.viewerLat" step="0.000001" placeholder="视点纬度">
                <input type="number" v-model.number="viewshedParams.viewerHeight" step="1" placeholder="视点高度">
              </div>
              <div class="param-item">
                <label>视角范围</label>
                <input type="number" v-model.number="viewshedParams.horizontalAngle" step="1" placeholder="水平角度">
                <input type="number" v-model.number="viewshedParams.verticalAngle" step="1" placeholder="垂直角度">
              </div>
              <div class="param-item">
                <label>可视距离</label>
                <input type="number" v-model.number="viewshedParams.radius" step="100" placeholder="可视半径(米)">
              </div>
              <button class="analysis-button" @click="runViewshedAnalysis">开始分析</button>
            </div>

            <!-- 缓冲区分析参数 -->
            <div v-if="currentAnalysis === 'buffer'" class="param-group">
              <div class="param-header">
                <h4>缓冲区分析参数</h4>
                <button class="clear-button" @click="$emit('clear-analysis')">清除分析</button>
              </div>
              <div class="param-item">
                <label>中心点坐标</label>
                <input type="number" v-model.number="bufferParams.centerLon" step="0.000001" placeholder="中心点经度">
                <input type="number" v-model.number="bufferParams.centerLat" step="0.000001" placeholder="中心点纬度">
              </div>
              <div class="param-item">
                <label>缓冲区半径</label>
                <input type="number" v-model.number="bufferParams.radius" step="100" placeholder="缓冲区半径(米)">
              </div>
              <button class="analysis-button" @click="runBufferAnalysis">开始分析</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 左上角浮动控制窗口 -->
    <div 
      class="floating-controls"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
      ref="floatingControls"
    >
      <div class="drag-handle" @mousedown="startDrag">
        <span class="drag-icon">⋮⋮</span>
        <span class="drag-text">拖动</span>
      </div>
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索地点..."
          @keyup.enter="handleSearch"
          @mousedown.stop
        >
        <button class="search-button control-button" @click="handleSearch">
        <span class="icon">🔍</span>
      </button>
      </div>
      <!-- 添加搜索结果列表 -->
      <div class="search-results" v-if="searchResults.length > 0">
        <div 
          v-for="(result, index) in searchResults" 
          :key="index"
          class="search-result-item"
          @click="handleLocationSelect(result)"
        >
          <span class="result-name">{{ result.display_name }}</span>
          <span class="result-type">{{ result.type }}</span>
        </div>
      </div>
      <div class="control-group">
        <button class="control-button" @click="$emit('zoom-in')">
        <span class="icon">🔍</span>
          <span class="text">放大</span>
      </button>
        <button class="control-button" @click="$emit('zoom-out')">
          <span class="icon">🔍</span>
          <span class="text">缩小</span>
        </button>
        <button class="control-button" @click="$emit('reset-view')">
        <span class="icon">🔄</span>
          <span class="text">重置</span>
      </button>
        <button class="control-button" @click="$emit('toggle-3d')">
        <span class="icon">🌍</span>
          <span class="text">2D/3D</span>
      </button>
      </div>

      <!-- 视角控制 -->
      <div class="camera-controls">
        <div class="camera-input-group">
          <label>Heading:</label>
          <div class="camera-input-container">
            <input 
              type="number" 
              v-model.number="cameraParams.heading" 
              min="0" 
              max="360" 
              step="0.1"
              @change="updateCamera"
              @mousedown.stop
              class="camera-input"
            />
            <span class="camera-unit">°</span>
          </div>
        </div>
        <div class="camera-input-group">
          <label>Pitch:</label>
          <div class="camera-input-container">
            <input 
              type="number" 
              v-model.number="cameraParams.pitch" 
              min="-90" 
              max="90" 
              step="0.1"
              @change="updateCamera"
              @mousedown.stop
              class="camera-input"
            />
            <span class="camera-unit">°</span>
          </div>
        </div>
        <div class="camera-input-group">
          <label>Roll:</label>
          <div class="camera-input-container">
            <input 
              type="number" 
              v-model.number="cameraParams.roll" 
              min="0" 
              max="360" 
              step="0.1"
              @change="updateCamera"
              @mousedown.stop
              class="camera-input"
            />
            <span class="camera-unit">°</span>
          </div>
        </div>
        <div class="camera-input-group">
          <label>Height:</label>
          <div class="camera-input-container">
            <input 
              type="number" 
              v-model.number="cameraParams.height" 
              min="0" 
              max="10000" 
              step="10"
              @change="updateHeight"
              @mousedown.stop
              class="camera-input"
            />
            <span class="camera-unit">m</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Sidebar',
  props: {
    coordinates: {
      type: Object,
      default: () => ({
        cartesian: null,
        cartographic: null
      })
    },
    currentCamera: {
      type: Object,
      default: () => ({
        heading: 0,
        pitch: -45,
        roll: 0,
        height: 1000
      })
    }
  },
  data() {
    return {
      isImageryOpen: false,
      isTerrainOpen: false,
      isCameraOpen: false,
      isDataOpen: false,
      isAnalysisOpen: false,
      currentAnalysis: null,
      imageryPosition: { x: 300, y: 70 },
      terrainPosition: { x: 500, y: 70 },
      dataPosition: { x: 700, y: 70 },
      analysisPosition: { x: 900, y: 70 },
      isDragging: false,
      currentWindow: null,
      pathParams: {
        startLon: null,
        startLat: null,
        endLon: null,
        endLat: null
      },
      visibilityParams: {
        observerLon: null,
        observerLat: null,
        observerHeight: 1.7,
        targetLon: null,
        targetLat: null,
        targetHeight: 0
      },
      viewshedParams: {
        viewerLon: null,
        viewerLat: null,
        viewerHeight: 1.7,
        horizontalAngle: 90,
        verticalAngle: 60,
        radius: 1000
      },
      bufferParams: {
        centerLon: null,
        centerLat: null,
        radius: 1000
      },
      dragOffset: { x: 0, y: 0 },
      cameraParams: {
        heading: 0,
        pitch: -45,
        roll: 0,
        height: 1000
      },
      assetId: '',
      searchQuery: '',
      searchResults: [],
      currentGeoJSONFile: null,
      modelOptions: [
        { name: 'Cesium Air', path: '../public/Apps/SampleData/models/CesiumAir/CesiumAir.glb' },
        { name: 'Cesium Balloon', path: '../public/Apps/SampleData/models/CesiumBalloon/CesiumBalloon.glb' },
        { name: 'Cesium Balloon KTX2', path: '../public/Apps/SampleData/models/CesiumBalloon/CesiumBalloonKTX2.glb' },
        { name: 'Ground Vehicle', path: '../public/Apps/SampleData/models/GroundVehicle/GroundVehicle.glb' },
        { name: 'Cesium Drone', path: '../public/Apps/SampleData/models/CesiumDrone/CesiumDrone.glb' },
        { name: 'Box Instanced', path: '../public/Apps/SampleData/models/BoxInstanced/BoxInstanced.gltf' },
        { name: 'Box Unlit', path: '../public/Apps/SampleData/models/BoxUnlit/BoxUnlit.gltf' },
        { name: 'Cesium Man', path: '../public/Apps/SampleData/models/CesiumMan/CesiumMan.glb' },
        { name: 'Cesium Milk Truck', path: '../public/Apps/SampleData/models/CesiumMilkTruck/CesiumMilkTruck.glb' },
        { name: 'Draco Compressed', path: './public/Apps/SampleData/models/DracoCompressed/CesiumMilkTruck.gltf' },
        { name: 'Parc Lead Mine', path: './public/Apps/SampleData/models/ParcLeadMine/ParcLeadMine.glb' },
        { name: 'Pawns', path: './public/Apps/SampleData/models/Pawns/Pawns.glb' },
        { name: 'Point Cloud Wave', path: './public/Apps/SampleData/models/PointCloudWave/PointCloudWave.glb' },
        { name: 'Shadow Tester', path: './public/Apps/SampleData/models/ShadowTester/Shadow_Tester.glb' },
        { name: 'Wood Tower', path: './public/Apps/SampleData/models/WoodTower/Wood_Tower.glb' }
      ],
      selectedModel: '',
      tilesOptions: [
        { name: 'Batched Colors', path: '../public/Apps/SampleData/Cesium3DTiles/Batched/BatchedColors/tileset.json' },
        { name: 'Batched With Batch Table', path: '../public/Apps/SampleData/Cesium3DTiles/Batched/BatchedWithBatchTable/tileset.json' },
        { name: 'Batched Translucent', path: '../public/Apps/SampleData/Cesium3DTiles/Batched/BatchedTranslucent/tileset.json' },
        { name: 'Batched Translucent Opaque Mix', path: '../public/Apps/SampleData/Cesium3DTiles/Batched/BatchedTranslucentOpaqueMix/tileset.json' },
        { name: 'Photogrammetry', path: '../public/Apps/SampleData/Cesium3DTiles/Classification/Photogrammetry/tileset.json' },
        { name: 'Point Cloud', path: '../public/Apps/SampleData/Cesium3DTiles/Classification/PointCloud/tileset.json' },
        { name: 'Composite', path: '../public/Apps/SampleData/Cesium3DTiles/Composite/Composite/tileset.json' },
        { name: 'Batch Table Hierarchy', path: '../public/Apps/SampleData/Cesium3DTiles/Hierarchy/BatchTableHierarchy/tileset.json' },
        { name: 'Instanced Orientation', path: '../public/Apps/SampleData/Cesium3DTiles/Instanced/InstancedOrientation/tileset.json' },
        { name: 'Instanced With Batch Table', path: '../public/Apps/SampleData/Cesium3DTiles/Instanced/InstancedWithBatchTable/tileset.json' },
        { name: 'Point Cloud RGB', path: '../public/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudRGB/tileset.json' },
        { name: 'Point Cloud Constant Color', path: '../public/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudConstantColor/tileset.json' },
        { name: 'Point Cloud Normals', path: '../public/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudNormals/tileset.json' },
        { name: 'Point Cloud Batched', path: '../public/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudBatched/tileset.json' },
        { name: 'Point Cloud Draco', path: '../public/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudDraco/tileset.json' },
        { name: 'Tileset', path: '../public/Apps/SampleData/Cesium3DTiles/Tilesets/Tileset/tileset.json' },
      ],
      selectedTileset: '',
      modelProperties: {
        longitude: -123.0744619,
        latitude: 44.0503706,
        height: 0,
        scale: 1.0,
        heading: 45.0,
        pitch: 15.0,
        roll: 0.0
      },
      position: {
        x: 280,  // 初始位置在左侧边栏右侧
        y: window.innerHeight - 400  // 初始位置在底部栏上方
      },
      isDragging: false,
      dragOffset: {
        x: 0,
        y: 0
      },
      colorSettings: {
        residential: { value: '#87CEEB', alpha: 0.8 }, // 浅蓝色
        commercial: { value: '#FFA500', alpha: 0.8 },  // 橙色
        industrial: { value: '#A9A9A9', alpha: 0.8 }   // 灰色
      },
      heightSettings: {
        baseHeight: 0,
        heightScale: 1
      },
      evacuationParams: {
        disasterType: null,
        location: null
      },
      isLocationPickingActive: false,
      facilityParams: {
        facilityName: '',
        count: 3,
        startLat: null,
        startLon: null
      },
      facilityResults: []
    }
  },
  watch: {
    currentCamera: {
      handler(newVal) {
        this.cameraParams = { ...newVal }
      },
      deep: true,
      immediate: true
    },
    coordinates: {
      handler(newCoordinates) {
        // 如果正在进行位置选择且有新的坐标
        if (this.isLocationPickingActive && newCoordinates.cartographic) {
          // 更新设施寻路的起点坐标
          this.facilityParams.startLon = parseFloat(newCoordinates.cartographic.longitude);
          this.facilityParams.startLat = parseFloat(newCoordinates.cartographic.latitude);
          
          // 关闭位置选择模式
          this.isLocationPickingActive = false;
          this.$emit('coordinate-picking-change', false);
        }
      },
      deep: true
    }
  },
  mounted() {
    // 添加全局鼠标事件监听，确保拖动功能在整个应用中都能正常工作
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.handleDrag(e);
      }
    });
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.stopDrag();
      }
    });
    
    // 初始化浮动窗口位置
    this.$nextTick(() => {
      const mainContent = document.querySelector('.main-content')
      const bottomBar = document.querySelector('.bottom-bar')
      const topBar = document.querySelector('.top-bar')
      const floatingControls = this.$refs.floatingControls
      if (mainContent && bottomBar && topBar && floatingControls) {
        const mainRect = mainContent.getBoundingClientRect()
        const bottomBarHeight = bottomBar.offsetHeight
        const floatingHeight = floatingControls.offsetHeight
        
        // 设置初始位置在左下角
        this.position = {
          x: 280,  // 紧贴左侧边栏
          y: mainRect.bottom - bottomBarHeight - floatingHeight - 20  // 底部栏上方20px
        }
      }
    })

    // 添加窗口大小变化监听
    window.addEventListener('resize', this.handleResize)
  },
  beforeDestroy() {
    // 移除全局鼠标事件监听
    document.removeEventListener('mousemove', this.handleDrag)
    document.removeEventListener('mouseup', this.stopDrag)
    window.removeEventListener('resize', this.handleResize)
  },
  computed: {
    canSearch() {
      return this.facilityParams.facilityName &&
             this.facilityParams.count > 0 &&
             this.facilityParams.startLat !== null &&
             this.facilityParams.startLon !== null;
    },
    canRunFacilitySearch() {
      return this.facilityParams.facilityName &&
             this.facilityParams.count > 0 &&
             this.facilityParams.startLat !== null &&
             this.facilityParams.startLon !== null;
    }
  },
  methods: {
    toggleDrawer(type) {
      switch (type) {
        case 'imagery':
          this.isImageryOpen = !this.isImageryOpen
          break
        case 'terrain':
          this.isTerrainOpen = !this.isTerrainOpen
          break
        case 'camera':
          this.isCameraOpen = !this.isCameraOpen
          break
        case 'data':
          this.isDataOpen = !this.isDataOpen
          break
        case 'analysis':
          this.isAnalysisOpen = !this.isAnalysisOpen
          break
      }
    },
    startDrag(event, windowType) {
      if (event.target.classList.contains('close-button')) return;
      
      this.isDragging = true;
      this.currentWindow = windowType;
      
      // 获取当前窗口元素和位置
      let currentPosition;
      if (windowType) {
        // 处理浮动窗口的拖动
        currentPosition = 
          windowType === 'imagery' ? this.imageryPosition :
          windowType === 'terrain' ? this.terrainPosition :
          windowType === 'data' ? this.dataPosition :
          windowType === 'analysis' ? this.analysisPosition :
          this.position;
      } else {
        // 处理控制面板的拖动（没有windowType参数时）
        currentPosition = this.position;
      }
      
      this.dragOffset = {
        x: event.clientX - currentPosition.x,
        y: event.clientY - currentPosition.y
      };
      
      event.preventDefault();
      event.stopPropagation(); // 防止事件冒泡
    },
    handleDrag(event) {
      if (!this.isDragging) return;
      
      // 计算新位置
      const newX = event.clientX - this.dragOffset.x;
      const newY = event.clientY - this.dragOffset.y;
      
      // 获取视口和窗口尺寸
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const windowElement = event.target.closest('.floating-window') || this.$refs.floatingControls;
      const windowWidth = windowElement ? windowElement.offsetWidth : 0;
      const windowHeight = windowElement ? windowElement.offsetHeight : 0;
      
      // 计算边界
      const minX = 280; // 左侧边栏宽度
      const maxX = viewportWidth - windowWidth;
      const minY = 0;
      const maxY = viewportHeight - windowHeight;
      
      // 应用边界限制并更新位置
      const boundedX = Math.max(minX, Math.min(maxX, newX));
      const boundedY = Math.max(minY, Math.min(maxY, newY));
      
      if (this.currentWindow === 'imagery') {
        this.imageryPosition = { x: boundedX, y: boundedY };
      } else if (this.currentWindow === 'terrain') {
        this.terrainPosition = { x: boundedX, y: boundedY };
      } else if (this.currentWindow === 'data') {
        this.dataPosition = { x: boundedX, y: boundedY };
      } else if (this.currentWindow === 'analysis') {
        this.analysisPosition = { x: boundedX, y: boundedY };
      } else {
        this.position = { x: boundedX, y: boundedY };
      }
    },
    stopDrag() {
      this.isDragging = false;
      this.currentWindow = null;
    },
    getWindowPosition(windowType) {
      switch(windowType) {
        case 'imagery': return this.imageryPosition;
        case 'terrain': return this.terrainPosition;
        case 'data': return this.dataPosition;
        case 'analysis': return this.analysisPosition;
        default: return this.position;
      }
    },
    calculateBounds() {
      return {
        minX: 0,
        maxX: window.innerWidth - 300,
        minY: 0,
        maxY: window.innerHeight - 100
      };
    },
    handle3DTilesLoad() {
      try {
        // 验证assetId
        if (!this.assetId) {
          alert('请输入Asset ID');
          return;
        }
        
        // 去除空格并转换为数字
        const numericAssetId = parseInt(this.assetId.toString().trim());
        
        // 验证是否为有效数字
        if (isNaN(numericAssetId) || numericAssetId <= 0) {
          alert('请输入有效的正整数Asset ID');
          return;
        }
        
        console.log('正在加载3D Tiles，Asset ID:', numericAssetId);
        this.$emit('load-3dtiles', numericAssetId);
      } catch (error) {
        console.error('处理3D Tiles加载请求时出错:', error);
        alert('处理3D Tiles加载请求时出错: ' + error.message);
      }
    },
    handleTilesetLoad() {
      if (!this.selectedTileset) {
        alert('请选择3D Tiles模型');
        return;
      }
      this.$emit('load-3dtiles-local', this.selectedTileset);
    },
    handleGeoJSONFile(event) {
      const file = event.target.files[0]
      if (file) {
        this.currentGeoJSONFile = file
        this.$emit('load-geojson', file, {
          colors: this.colorSettings,
          height: this.heightSettings
        })
      }
    },
    handleModelLoad() {
      if (!this.selectedModel) {
        alert('请选择模型');
        return;
      }
      // 验证模型属性
      const { longitude, latitude, height } = this.modelProperties;
      if (!longitude || !latitude) {
        alert('请输入有效的经纬度');
        return;
      }
      this.$emit('load-gitf', this.selectedModel, this.modelProperties);
    },
    handle3DTilesClear() {
      this.$emit('clear-3dtiles')
      this.assetId = ''
      this.selectedTileset = ''
    },
    handleGeoJSONClear() {
      this.$emit('clear-geojson')
      this.currentGeoJSONFile = null
      // 重置文件输入框
      const fileInputs = document.querySelectorAll('input[type="file"][accept=".geojson,.json"]')
      fileInputs.forEach(input => input.value = '')
    },
    handleGITFClear() {
      this.$emit('clear-gitf')
      this.selectedModel = '' // 清空选择的模型
    },
    updateCamera() {
      this.$emit('update-camera', {
        heading: Number(this.cameraParams.heading),
        pitch: Number(this.cameraParams.pitch),
        roll: Number(this.cameraParams.roll)
      })
    },
    updateHeight() {
      this.$emit('update-height', this.cameraParams.height);
    },
    handleClearMarkers() {
      this.$emit('clear-markers')
    },
    async handleSearch() {
      if (!this.searchQuery.trim()) return;
      
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchQuery)}&limit=5`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          this.searchResults = data;
        } else {
          this.searchResults = [];
          alert('未找到该地点');
        }
      } catch (error) {
        console.error('搜索地点失败:', error);
        alert('搜索地点失败，请稍后重试');
      }
    },
    handleLocationSelect(location) {
      this.$emit('fly-to-location', {
        lat: parseFloat(location.lat),
        lon: parseFloat(location.lon),
        height: 1000
      });
      this.searchResults = []; // 清空搜索结果
      this.searchQuery = ''; // 清空搜索框
    },
    handleResize() {
      const mainContent = document.querySelector('.main-content')
      const bottomBar = document.querySelector('.bottom-bar')
      const topBar = document.querySelector('.top-bar')
      const floatingControls = this.$refs.floatingControls
      
      if (mainContent && bottomBar && topBar && floatingControls) {
        const mainRect = mainContent.getBoundingClientRect()
        const bottomBarHeight = bottomBar.offsetHeight
        const topBarHeight = topBar.offsetHeight
        const floatingRect = floatingControls.getBoundingClientRect()

        // 确保不会超出边界
        this.position = {
          x: Math.max(280, 
                     Math.min(mainRect.right - floatingRect.width - 20, this.position.x)),
          y: Math.min(mainRect.bottom - bottomBarHeight - floatingRect.height - 20,
                     Math.max(topBarHeight + 20, this.position.y))
        }
      }
    },
    handleStyleChange() {
      this.$emit('update-geojson-style', {
        colors: this.colorSettings,
        height: this.heightSettings
      })
    },
    startAnalysis(type) {
      this.currentAnalysis = type;
      
      // 只有当有当前坐标时才设置初始值
      if (this.coordinates && this.coordinates.cartographic) {
        const lon = parseFloat(this.coordinates.cartographic.longitude);
        const lat = parseFloat(this.coordinates.cartographic.latitude);
        const height = parseFloat(this.coordinates.cartographic.height);

        switch(type) {
          case 'path':
            // 如果起点未设置，则设置为当前点
            if (!this.pathParams.startLon || !this.pathParams.startLat) {
              this.pathParams.startLon = lon;
              this.pathParams.startLat = lat;
            } else {
              // 如果起点已设置，则设置为终点
              this.pathParams.endLon = lon;
              this.pathParams.endLat = lat;
            }
            break;
          case 'visibility':
            // 如果观察点未设置，则设置为当前点
            if (!this.visibilityParams.observerLon || !this.visibilityParams.observerLat) {
              this.visibilityParams.observerLon = lon;
              this.visibilityParams.observerLat = lat;
              this.visibilityParams.observerHeight = height || 1.7; // 默认观察者高度1.7米
            } else {
              // 如果观察点已设置，则设置为目标点
              this.visibilityParams.targetLon = lon;
              this.visibilityParams.targetLat = lat;
              this.visibilityParams.targetHeight = height || 0;
            }
            break;
          case 'viewshed':
            this.viewshedParams.viewerLon = lon;
            this.viewshedParams.viewerLat = lat;
            this.viewshedParams.viewerHeight = height || 1.7; // 默认观察者高度1.7米
            break;
          case 'buffer':
            this.bufferParams.centerLon = lon;
            this.bufferParams.centerLat = lat;
            break;
        }
      }
    },
    runPathAnalysis() {
      if (!this.validatePathParams()) {
        alert('请输入有效的起点和终点坐标');
        return;
      }
      this.$emit('run-path-analysis', this.pathParams);
    },
    runVisibilityAnalysis() {
      if (!this.validateVisibilityParams()) {
        alert('请输入有效的观察点和目标点坐标');
        return;
      }
      this.$emit('run-visibility-analysis', this.visibilityParams);
    },
    runViewshedAnalysis() {
      if (!this.validateViewshedParams()) {
        alert('请输入有效的视点坐标和参数');
        return;
      }
      this.$emit('run-viewshed-analysis', this.viewshedParams);
    },
    runBufferAnalysis() {
      if (!this.validateBufferParams()) {
        alert('请输入有效的中心点坐标和半径');
        return;
      }
      this.$emit('run-buffer-analysis', this.bufferParams);
    },
    async startFacilitySearch() {
      if (!this.facilityParams.facilityName || !this.facilityParams.count || !this.facilityParams.startLat || !this.facilityParams.startLon) {
        alert('请填写完整的搜索参数');
        return;
      }

      this.isSearching = true;
      this.facilityResults = []; // 清空之前的结果

      try {
        // 确保搜索关键词不为空
        const keyword = this.facilityParams.facilityName.trim();
        if (!keyword) {
          throw new Error('请输入设施名称');
        }

        // 发送搜索请求
        await this.$emit('run-facility-search', {
          ...this.facilityParams,
          facilityName: keyword
        });
      } catch (error) {
        console.error('设施搜索失败:', error);
        alert(error.message || '搜索失败，请重试');
        this.facilityResults = []; // 清空结果
      } finally {
        this.isSearching = false;
      }
    },
    validatePathParams() {
      return this.pathParams.startLon != null && 
             this.pathParams.startLat != null &&
             this.pathParams.endLon != null &&
             this.pathParams.endLat != null;
    },
    validateVisibilityParams() {
      return this.visibilityParams.observerLon != null &&
             this.visibilityParams.observerLat != null &&
             this.visibilityParams.targetLon != null &&
             this.visibilityParams.targetLat != null;
    },
    validateViewshedParams() {
      return this.viewshedParams.viewerLon != null &&
             this.viewshedParams.viewerLat != null &&
             this.viewshedParams.horizontalAngle > 0 &&
             this.viewshedParams.verticalAngle > 0 &&
             this.viewshedParams.radius > 0;
    },
    validateBufferParams() {
      return this.bufferParams.centerLon != null &&
             this.bufferParams.centerLat != null &&
             this.bufferParams.radius > 0;
    },
    startLocationPicking() {
      this.isLocationPickingActive = true;
      // 发送事件通知开始选点
      this.$emit('coordinate-picking-change', true);
      // 提示用户点击地图选择位置
      alert('请点击地图选择起点位置');
    },
    clearEvacuationAnalysis() {
      // 重置灾害疏散分析参数
      this.evacuationParams = {
        disasterType: null,
        location: null
      };
      
      // 通知父组件清除分析结果
      this.$emit('clear-analysis');
    },
    async bufferAnalysis(centerPoint, radius) {
      this.clearAnalysis();

      // 创建中心点
      const centerEntity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(centerPoint.longitude, centerPoint.latitude),
        point: {
          color: Cesium.Color.RED,
          pixelSize: 10
        }
      });

      // 计算缓冲区边界点
      const bufferPositions = await this.createBuffer(centerPoint.longitude, centerPoint.latitude, radius);
      
      // 创建缓冲区多边形
      const bufferEntity = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(bufferPositions),
          material: Cesium.Color.GREEN.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.GREEN,
          outlineWidth: 2,
          // 确保贴地
          perPositionHeight: false,
          clampToGround: true
        }
      });

      return {
        centerEntity,
        bufferEntity
      };
    },
    // 计算缓冲区上的点
    calculateBufferPoint(centerLon, centerLat, radius, angle) {
      const radianAngle = angle * Math.PI / 180;
      
      // 使用Cesium的geodesic计算
      const centerCartographic = Cesium.Cartographic.fromDegrees(centerLon, centerLat);
      const geodesic = new Cesium.EllipsoidGeodesic();
      
      // 计算目标点的位置
      const bearing = radianAngle;
      geodesic.setEndPoints(
          centerCartographic,
          centerCartographic
      );
      geodesic.interpolateUsingSurfaceDistance(radius, centerCartographic);
      
      // 返回计算后的坐标
      const cartesian = Cesium.Cartesian3.fromRadians(
          centerCartographic.longitude,
          centerCartographic.latitude
      );
      
      return cartesian;
    },
    // 创建缓冲区
    async createBuffer(centerLon, centerLat, radius) {
      const positions = [];
      const segments = 64; // 分段数
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 360;
        const point = this.calculateBufferPoint(centerLon, centerLat, radius, angle);
        positions.push(point);
      }
      
      return positions;
    },
    updateFacilityResults(results) {
      this.facilityResults = results;
      if (results.length === 0) {
        alert('未找到符合条件的设施，请尝试其他关键词');
      }
    },
    clearFacilitySearch() {
      // 重置设施搜索参数
      this.facilityParams = {
        facilityName: '',
        count: 3,
        startLat: null,
        startLon: null
      };
      
      // 清空搜索结果
      this.facilityResults = [];
      
      // 清除地图上的分析结果
      this.$emit('clear-analysis');
      
      // 重置位置选择状态
      this.isLocationPickingActive = false;
      this.$emit('coordinate-picking-change', false);
    },
  },
}
</script>

<style scoped>
.layout-container {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.layout-container > * {
  pointer-events: auto;
}

/* 左侧边栏样式 */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100%;
  background-color: #2c3e50;
  color: #ecf0f1;
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 15px;
  overflow-y: auto;
}

.sidebar-content h2 {
  margin: 0 0 15px 0;
  color: #ecf0f1;
  font-size: 1.3em;
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #34495e;
}

/* 顶部栏样式 */
.top-bar {
  position: fixed;
  top: 0;
  left: 280px;
  right: 0;
  height: 60px;
  background-color: #2c3e50;
  display: flex;
  align-items: center;
  padding: 0 20px;
  z-index: 1000;
  border-bottom: 1px solid #34495e;
}

/* 水平抽屉样式 */
.floating-window {
  position: fixed;
  background-color: rgba(44, 62, 80, 0.95);
  border-radius: 8px;
  min-width: 200px;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: rgba(52, 73, 94, 0.8);
  border-radius: 8px 8px 0 0;
  cursor: move;
}

.window-title {
  color: #ecf0f1;
  font-weight: 500;
  font-size: 0.9em;
}

.close-button {
  background: none;
  border: none;
  color: #ecf0f1;
  font-size: 1.2em;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: #e74c3c;
}

.window-content {
  padding: 12px;
}

.drawer-button {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 6px;
  background-color: rgba(52, 73, 94, 0.6);
  border: none;
  border-radius: 4px;
  color: #ecf0f1;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85em;
}

.drawer-button:hover {
  background-color: rgba(52, 152, 219, 0.8);
  transform: translateX(2px);
}

.drawer-button .icon {
  margin-right: 8px;
  font-size: 1em;
}

.drawer-button .text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

/* 数据加载组样式 */
.data-load-group {
  margin-bottom: 8px;
  padding: 8px;
  background-color: #34495e;
  border-radius: 3px;
}

.input-group {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.input-group .drawer-button {
  width: auto;
  min-width: 32px;
  padding: 4px;
  white-space: nowrap;
}

.input-group .drawer-button .icon {
  margin-right: 0;
  font-size: 0.9em;
}

.asset-input {
  flex: 1;
  padding: 4px 6px;
  background-color: #2c3e50;
  border: 1px solid #34495e;
  border-radius: 3px;
  color: #ecf0f1;
  font-size: 0.85em;
}

.file-input {
  width: 100%;
  margin-bottom: 6px;
  padding: 4px 6px;
  background-color: #2c3e50;
  border: 1px solid #34495e;
  border-radius: 3px;
  color: #ecf0f1;
  font-size: 0.85em;
  cursor: pointer;
}

.model-select {
  flex: 1;
  padding: 4px 6px;
  background-color: #2c3e50;
  border: 1px solid #34495e;
  border-radius: 3px;
  color: #ecf0f1;
  font-size: 0.85em;
  cursor: pointer;
  margin-bottom: 0;
}

/* 左上角浮动控制窗口样式 */
.floating-controls {
  position: fixed;
  background-color: rgba(44, 62, 80, 0.15);
  border-radius: 8px;
  padding: 10px;
  z-index: 1000;
  width: 290px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.floating-controls.dragging {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  margin: -10px -10px 5px -10px;
  background-color: rgba(52, 73, 94, 0.4);
  border-radius: 8px 8px 0 0;
  cursor: move;
  user-select: none;
  transition: background-color 0.2s ease;
  height: 20px;
}

.drag-handle:hover {
  background-color: rgba(52, 152, 219, 0.4);
}

.drag-icon {
  color: #ecf0f1;
  margin-right: 4px;
  font-size: 12px;
}

.drag-text {
  color: #ecf0f1;
  font-size: 11px;
  font-weight: 400;
}

.search-box {
  display: flex;
  gap: 3px;
  margin-bottom: 6px;
  width: 100%;
  position: relative;
}

.search-box input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.7em;
  outline: none;
}

.search-box input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.search-box input:focus {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.15);
}

.search-button {
  min-width: 60px;
}

.control-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 10px;
}

.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5px;
  background-color: rgba(52, 73, 94, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #ecf0f1;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9em;
  white-space: nowrap;
}

.control-button.active {
  background-color: rgba(52, 152, 219, 0.8);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.control-button:hover {
  background-color: rgba(52, 152, 219, 0.6);
  transform: translateY(-1px);
}

.control-button .icon {
  margin-right: 8px;
  font-size: 1.2em;
}

.control-button .text {
  font-weight: 500;
}

.camera-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: rgba(52, 73, 94, 0.2);
  padding: 6px;
  border-radius: 3px;
  margin-top: 0;
}

.camera-input-group {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  width: 100%;
}

.camera-input-group:last-child {
  margin-bottom: 0;
}

.camera-input-group label {
  width: 60px;
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}

/* 为Roll输入框增加宽度 */
.camera-input-group:nth-child(3) .camera-input-container {
  min-width: 70px;
}

.camera-input-container {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 80px;
}

.camera-input {
  flex: 1;
  padding: 4px 6px;
  background-color: rgba(44, 62, 80, 0.7);
  border: 1px solid rgba(52, 152, 219, 0.5);
  border-radius: 4px;
  color: #ecf0f1;
  font-size: 13px;
  transition: all 0.2s ease;
  min-width: 65px;
  cursor: text;
  pointer-events: auto;
  z-index: 10;
}

.camera-input:focus {
  outline: none;
  border-color: #3498db;
  background-color: rgba(44, 62, 80, 0.9);
}

.camera-input:hover {
  border-color: #3498db;
}

.camera-unit {
  font-size: 13px;
  color: #ecf0f1;
  min-width: 15px;
  flex-shrink: 0;
}

/* 添加过渡动画 */
.drawer-content {
  transition: all 0.3s ease;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-results {
  position: relative;
  width: 100%;
  background: rgba(44, 62, 80, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin-bottom: 6px;
  max-height: 150px;
  overflow-y: auto;
  backdrop-filter: blur(8px);
}

.search-result-item {
  padding: 8px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: rgba(52, 152, 219, 0.3);
}

.result-name {
  color: #fff;
  font-size: 0.75em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-type {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.7em;
}

/* 自定义滚动条样式 */
.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-results::-webkit-scrollbar-track {
  background: rgba(44, 62, 80, 0.3);
}

.search-results::-webkit-scrollbar-thumb {
  background: rgba(52, 152, 219, 0.4);
  border-radius: 3px;
}

.search-results::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 152, 219, 0.6);
}

.model-properties {
  background-color: #34495e;
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
}

.property-group {
  margin-bottom: 10px;
}

.property-group label {
  display: block;
  color: #ecf0f1;
  font-size: 12px;
  margin-bottom: 5px;
}

.property-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.property-group input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #3498db;
  border-radius: 3px;
  background-color: #2c3e50;
  color: #ecf0f1;
  font-size: 12px;
}

.property-group input:focus {
  outline: none;
  border-color: #2980b9;
}

.geojson-style-panel {
  background: rgba(44, 62, 80, 0.8);
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
}

.style-section {
  margin: 10px 0;
}

.style-section h5 {
  margin: 5px 0;
  color: #ffffff;
}

.color-setting, .height-setting {
  display: flex;
  align-items: center;
  margin: 5px 0;
  gap: 5px;
}

.color-setting label, .height-setting label {
  flex: 1;
  color: #ffffff;
}

.color-setting input[type="color"] {
  width: 50px;
  height: 25px;
  padding: 0;
  border: none;
}

.color-setting input[type="number"],
.height-setting input[type="number"] {
  width: 60px;
  padding: 2px 5px;
  background: #34495e;
  border: 1px solid #456789;
  color: #ffffff;
}

.top-buttons {
  display: flex;
  gap: 10px;
  padding: 10px;
}

.top-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background-color: rgba(52, 73, 94, 0.4);
  color: #ecf0f1;
  cursor: pointer;
  transition: all 0.3s ease;
}

.top-button:hover {
  background-color: rgba(52, 152, 219, 0.8);
  transform: translateY(-1px);
}

.top-button .icon {
  font-size: 1.2em;
}

.top-button .text {
  font-size: 14px;
}

/* 分析参数设置面板样式 */
.analysis-params {
  margin-top: 10px;
  padding: 10px;
  background-color: rgba(52, 73, 94, 0.6);
  border-radius: 4px;
}

.param-group {
  margin-bottom: 15px;
}

.param-group h4 {
  color: #ecf0f1;
  font-size: 14px;
  margin-bottom: 10px;
}

.param-item {
  margin-bottom: 8px;
}

.param-item label {
  display: block;
  color: #ecf0f1;
  font-size: 12px;
  margin-bottom: 4px;
}

.param-item input {
  width: 100%;
  padding: 4px 8px;
  background-color: #2c3e50;
  border: 1px solid #3498db;
  border-radius: 3px;
  color: #ecf0f1;
  font-size: 12px;
  margin-bottom: 4px;
}

.param-item input:focus {
  outline: none;
  border-color: #2980b9;
}

.analysis-button {
  width: 100%;
  padding: 8px;
  background-color: #3498db;
  border: none;
  border-radius: 4px;
  color: #ecf0f1;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.analysis-button:hover {
  background-color: #2980b9;
}

/* 添加新的样式 */
.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.clear-button {
  padding: 4px 8px;
  background-color: #e74c3c;
  border: none;
  border-radius: 4px;
  color: #ecf0f1;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.clear-button:hover {
  background-color: #c0392b;
}

/* 修复滑块样式 */
.slider-with-value input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: rgba(52, 73, 94, 0.6);
  border-radius: 2px;
  outline: none;
}

.slider-with-value input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #3498db;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.slider-with-value input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #3498db;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s ease;
}

.slider-with-value input[type="range"]::-webkit-slider-thumb:hover {
  background: #2980b9;
}

.slider-with-value input[type="range"]::-moz-range-thumb:hover {
  background: #2980b9;
}

/* 修复窗口内容滚动 */
.window-content {
  max-height: calc(80vh - 40px);
  overflow-y: auto;
  padding-right: 8px;
}

.window-content::-webkit-scrollbar {
  width: 6px;
}

.window-content::-webkit-scrollbar-track {
  background: rgba(44, 62, 80, 0.3);
}

.window-content::-webkit-scrollbar-thumb {
  background: rgba(52, 152, 219, 0.4);
  border-radius: 3px;
}

.window-content::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 152, 219, 0.6);
}

/* 灾害疏散分析面板样式 */
.evacuation-panel {
  background-color: rgba(52, 73, 94, 0.6);
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.evacuation-panel h3 {
  color: #ecf0f1;
  font-size: 16px;
  margin-bottom: 15px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.evacuation-panel .param-item {
  margin-bottom: 15px;
}

.evacuation-panel .param-item label {
  display: block;
  color: #ecf0f1;
  font-size: 14px;
  margin-bottom: 8px;
}

.evacuation-panel .disaster-select {
  width: 100%;
  padding: 8px;
  background-color: rgba(44, 62, 80, 0.8);
  border: 1px solid rgba(52, 152, 219, 0.5);
  border-radius: 4px;
  color: #ecf0f1;
  font-size: 14px;
  margin-bottom: 10px;
}

.evacuation-panel .coordinate-display {
  background-color: rgba(44, 62, 80, 0.8);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-family: monospace;
  font-size: 12px;
  color: #ecf0f1;
}

.evacuation-panel .location-button {
  width: 100%;
  padding: 8px;
  background-color: #3498db;
  color: #ecf0f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.evacuation-panel .location-button:hover {
  background-color: #2980b9;
}

.evacuation-panel .location-button:disabled {
  background-color: rgba(52, 73, 94, 0.6);
  cursor: not-allowed;
}

.evacuation-panel .analysis-button {
  width: 100%;
  padding: 10px;
  background-color: #2ecc71;
  color: #ecf0f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 10px;
  transition: background-color 0.2s;
}

.evacuation-panel .analysis-button:hover {
  background-color: #27ae60;
}

.evacuation-panel .analysis-button:disabled {
  background-color: rgba(52, 73, 94, 0.6);
  cursor: not-allowed;
}

.evacuation-panel .clear-button {
  width: 100%;
  padding: 8px;
  background-color: #e74c3c;
  color: #ecf0f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.evacuation-panel .clear-button:hover {
  background-color: #c0392b;
}

/* 设施寻路分析面板样式 */
.facility-panel {
  padding: 15px;
  background-color: #34495e;
  border-radius: 4px;
  margin-bottom: 15px;
}

.facility-panel h3 {
  color: #ecf0f1;
  margin-bottom: 15px;
  font-size: 16px;
}

.facility-panel .param-item {
  margin-bottom: 15px;
}

.facility-panel label {
  display: block;
  color: #ecf0f1;
  margin-bottom: 5px;
  font-size: 14px;
}

.facility-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #2c3e50;
  border-radius: 4px;
  background-color: #2c3e50;
  color: #ecf0f1;
  font-size: 14px;
}

.facility-input:focus {
  outline: none;
  border-color: #3498db;
}

.pick-location-btn {
  width: 100%;
  padding: 8px;
  background-color: #3498db;
  border: none;
  border-radius: 4px;
  color: #ecf0f1;
  cursor: pointer;
  font-size: 14px;
}

.pick-location-btn:hover {
  background-color: #2980b9;
}

.search-btn {
  width: 100%;
  padding: 10px;
  background-color: #2ecc71;
  border: none;
  border-radius: 4px;
  color: #ecf0f1;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.search-btn:hover {
  background-color: #27ae60;
}

.search-btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.clear-btn {
  width: 100%;
  padding: 8px;
  background-color: #e74c3c;
  border: none;
  border-radius: 4px;
  color: #ecf0f1;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  margin-top: 8px;
}

.clear-btn:hover {
  background-color: #c0392b;
}

.coordinate-display {
  background-color: #2c3e50;
  padding: 8px;
  border-radius: 4px;
  color: #ecf0f1;
  font-size: 12px;
  margin-bottom: 8px;
}

.facility-results {
  margin-top: 20px;
  border-top: 1px solid #2c3e50;
  padding-top: 15px;
}

.facility-results h4 {
  color: #ecf0f1;
  margin-bottom: 10px;
  font-size: 14px;
}

.result-list {
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  background-color: #2c3e50;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.facility-name {
  color: #ecf0f1;
  font-weight: bold;
  font-size: 14px;
}

.facility-type {
  padding: 2px 6px;
  border-radius: 3px;
  color: #ffffff;
  font-size: 12px;
}

.result-info {
  color: #bdc3c7;
  font-size: 12px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 4px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-icon {
  margin-right: 6px;
  font-style: normal;
  min-width: 16px;
}

.info-row span {
  flex: 1;
  word-break: break-all;
}
</style> 
