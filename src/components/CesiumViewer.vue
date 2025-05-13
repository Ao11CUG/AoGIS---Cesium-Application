<template>
  <div id="cesiumContainer"></div>
</template>

<script>
import { SpatialAnalysis } from '../utils/SpatialAnalysis'
import { BuildingInfoTool } from '../utils/BuildingInfoTool'

export default {
  name: 'CesiumViewer',
  data() {
    return {
      viewer: null,
      // 影像图层列表
      imageryLayers: {
        default: null,
        tianditu: null,
        amap: null
      },
      // 地形图层
      terrainProvider: null,
      // 空间分析工具
      spatialAnalysis: null,
      // 建筑信息工具
      buildingInfoTool: null,
    }
  },
  mounted() {
    window.Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYmMzZDlhNC0xMzFiLTRmZDUtYTBjNi05NGY2YWViOTgwZGUiLCJpZCI6Mjg3NzgwLCJpYXQiOjE3NDI5NzE5MzR9.LjVgE-5tkTcmKbwkTArMHLhmL2QCy6i69v-Lpgc78Rw'
    
    this.viewer = new window.Cesium.Viewer('cesiumContainer', {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: true,
      vrButton: false,
      geocoder: true,
      homeButton: false,
      infoBox: true,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false
    })

    // 初始化默认影像图层
    this.initDefaultImagery()
    // 初始化地形
    this.initTerrain()

    this.resetView()

    // 启用地形深度测试
    this.viewer.scene.globe.depthTestAgainstTerrain = true

    // 等待所有初始化完成
    Promise.all([
      this.viewer.scene.globe.readyPromise,
      this.viewer.terrainProvider.readyPromise
    ]).then(() => {
      console.log('Cesium viewer fully initialized')
      // 初始化空间分析工具
      this.spatialAnalysis = new SpatialAnalysis(this.viewer)
      // 初始化建筑信息工具
      this.buildingInfoTool = new BuildingInfoTool(this.viewer)
      // 通知父组件viewer已准备好
      this.$emit('viewer-ready', this.viewer)
    }).catch(error => {
      console.error('Error initializing Cesium viewer:', error)
    })
  },
  methods: {
    // 初始化默认影像图层
    initDefaultImagery() {
      try {
        console.log('初始化默认Cesium影像...');
        // 默认使用 Cesium World Imagery
        const imageryProvider = new window.Cesium.IonImageryProvider({
          assetId: 3845,
          accessToken: window.Cesium.Ion.defaultAccessToken
        });
        
        if (!imageryProvider) {
          console.error('创建影像提供者失败');
          return;
        }

        // 检查 readyPromise 是否存在
        if (imageryProvider.readyPromise) {
          imageryProvider.readyPromise
            .then(() => {
              console.log('默认影像提供者已就绪');
              this.imageryLayers.default = this.viewer.imageryLayers.addImageryProvider(imageryProvider);
              this.imageryLayers.default.show = true;
              console.log('默认影像图层已添加并显示');
              
              // 通知父组件默认图层已加载
              this.$emit('update:currentImagery', 'default');
            })
            .catch(error => {
              console.error('加载Cesium影像时出错:', error);
            });
        } else {
          // 如果没有 readyPromise，直接添加图层
          console.log('影像提供者无readyPromise，直接添加图层');
          this.imageryLayers.default = this.viewer.imageryLayers.addImageryProvider(imageryProvider);
          this.imageryLayers.default.show = true;
          console.log('默认影像图层已直接添加并显示');
          
          // 通知父组件默认图层已加载
          this.$emit('update:currentImagery', 'default');
        }
      } catch (error) {
        console.error('初始化默认影像图层时出错:', error);
      }
    },

    // 加载天地图影像
    loadTiandituImagery() {
      if (!this.imageryLayers.tianditu) {
        this.imageryLayers.tianditu = this.viewer.imageryLayers.addImageryProvider(
          new window.Cesium.WebMapTileServiceImageryProvider({
            url: 'http://t0.tianditu.gov.cn/img_w/wmts?tk=b60bb00bdd4364a3036357ca60f45dce', // 需要替换为你的天地图 Key
            layer: 'img',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18
          })
        )
      }
      this.switchImagery('tianditu')
    },

    // 加载高德地图影像
    loadAmapImagery() {
      if (!this.imageryLayers.amap) {
        this.imageryLayers.amap = this.viewer.imageryLayers.addImageryProvider(
          new window.Cesium.UrlTemplateImageryProvider({
            url: 'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© AutoNavi'
          })
        );
        this.imageryLayers.amap.show = false;  // 初始设置为隐藏
      }
      this.switchImagery('amap');
    },

    // 切换影像图层
    switchImagery(type) {
      console.log(`切换到图层类型: ${type}`);
      
      try {
        // 记录图层切换前的状态
        Object.keys(this.imageryLayers).forEach(key => {
          if (this.imageryLayers[key]) {
            console.log(`图层 ${key} 切换前状态: ${this.imageryLayers[key].show}`);
          } else {
            console.log(`图层 ${key} 不存在`);
          }
        });
        
        // 隐藏所有图层
        Object.keys(this.imageryLayers).forEach(key => {
          if (this.imageryLayers[key]) {
            this.imageryLayers[key].show = false;
            console.log(`图层 ${key} 已隐藏`);
          }
        });
        
        // 显示选中的图层
        if (this.imageryLayers[type]) {
          this.imageryLayers[type].show = true;
          console.log(`图层 ${type} 已显示`);
          
          // 确保选中的图层在最顶层
          const selectedLayer = this.imageryLayers[type];
          const layerIndex = this.viewer.imageryLayers.indexOf(selectedLayer);
          if (layerIndex >= 0) {
            // 如果图层不在最顶层，则将其移到最顶层
            const topIndex = this.viewer.imageryLayers.length - 1;
            if (layerIndex < topIndex) {
              this.viewer.imageryLayers.raise(selectedLayer, topIndex - layerIndex);
              console.log(`图层 ${type} 已提升到顶层`);
            }
          }
        } else if (type === 'amap') {
          // 如果是高德地图且尚未加载，则加载它
          console.log('高德地图未加载，正在加载...');
          this.loadAmapImagery();
          return; // loadAmapImagery内部会调用switchImagery，这里直接返回
        } else {
          console.warn(`请求的图层类型 ${type} 不存在`);
        }
        
        // 更新当前底图类型
        this.$emit('update:currentImagery', type);
        
        // 记录图层切换后的状态
        Object.keys(this.imageryLayers).forEach(key => {
          if (this.imageryLayers[key]) {
            console.log(`图层 ${key} 切换后状态: ${this.imageryLayers[key].show}`);
          }
        });
      } catch (error) {
        console.error('切换图层时出错:', error);
      }
    },

    // 初始化地形
    initTerrain() {
      try {
        // 使用 Cesium World Terrain
        this.terrainProvider = new Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
        requestVertexNormals: true,  //可以增加法线，用于提高光照效果
        requestWaterMask: true, //可以增加水面特效
    })
        this.viewer.terrainProvider = this.terrainProvider
        console.log('Terrain provider initialized')
      } catch (error) {
        console.error('Error initializing terrain:', error)
      }
    },

    // 切换地形
    switchTerrain(type) {
      try {
        switch (type) {
          case 'world':
            this.viewer.terrainProvider = new window.Cesium.WorldTerrain({
              requestVertexNormals: true,
              requestWaterMask: true
            })
            break
          case 'ellipsoid':
            this.viewer.terrainProvider = new window.Cesium.EllipsoidTerrainProvider()
            break
          case 'none':
            this.viewer.terrainProvider = null
            break
        }
        console.log('Terrain switched to:', type)
      } catch (error) {
        console.error('Error switching terrain:', error)
      }
    },

    zoomIn() {
      const camera = this.viewer.camera
      const distance = camera.positionCartographic.height
      camera.zoomIn(distance * 0.5)
    },
    zoomOut() {
      const camera = this.viewer.camera
      const distance = camera.positionCartographic.height
      camera.zoomOut(distance * 0.5)
    },
    resetView() {
      this.viewer.camera.flyTo({
        destination: window.Cesium.Cartesian3.fromDegrees(114.617104, 30.457544, 500),
        orientation: {
          heading: window.Cesium.Math.toRadians(0),
          pitch: window.Cesium.Math.toRadians(-45),
          roll: 0
        }
      })
    },
    toggle3D() {
      const scene = this.viewer.scene
      if (scene.mode === window.Cesium.SceneMode.SCENE3D) {
        scene.morphTo2D(0)
      } else {
        scene.morphTo3D(0)
      }
    },

    // 可视域分析
    async startViewshedAnalysis(params) {
      try {
        const result = await this.spatialAnalysis.viewshedAnalysis(
          {
            longitude: params.viewerLon,
            latitude: params.viewerLat,
            height: params.viewerHeight
          },
          {
            horizontalAngle: params.horizontalAngle,
            verticalAngle: params.verticalAngle,
            radius: params.radius
          }
        )
        return result
      } catch (error) {
        console.error('可视域分析失败:', error)
        return null
      }
    },

    // 缓冲区分析
    async startBufferAnalysis(params) {
      try {
        const result = await this.spatialAnalysis.bufferAnalysis(
          {
            longitude: params.centerLon,
            latitude: params.centerLat
          },
          params.radius
        )
        return result
      } catch (error) {
        console.error('缓冲区分析失败:', error)
        return null
      }
    },

    // 清除分析结果
    clearAnalysis() {
      if (this.spatialAnalysis) {
        this.spatialAnalysis.clearAnalysis()
      }
    },
    // 设置相机视角
    setCameraView(heading, pitch, roll) {
      this.viewer.camera.setView({
        orientation: {
          heading: window.Cesium.Math.toRadians(heading),
          pitch: window.Cesium.Math.toRadians(pitch),
          roll: window.Cesium.Math.toRadians(roll)
        }
      })
    },

    // 设置相机高度
    setCameraHeight(height) {
      const currentPosition = this.viewer.camera.positionCartographic
      this.viewer.camera.setView({
        destination: window.Cesium.Cartesian3.fromDegrees(
          window.Cesium.Math.toDegrees(currentPosition.longitude),
          window.Cesium.Math.toDegrees(currentPosition.latitude),
          height
        )
      })
    },

    // 设置视野范围
    setViewRange(range) {
      this.viewer.camera.frustum.far = range
    },

    // 获取当前相机参数
    getCameraParams() {
      const camera = this.viewer.camera
      return {
        heading: window.Cesium.Math.toDegrees(camera.heading),
        pitch: window.Cesium.Math.toDegrees(camera.pitch),
        roll: window.Cesium.Math.toDegrees(camera.roll),
        height: camera.positionCartographic.height
      }
    }
  },
  beforeDestroy() {
    if (this.buildingInfoTool) {
      this.buildingInfoTool.destroy();
    }
    if (this.viewer) {
      this.viewer.destroy();
    }
  }
}
</script>

<style scoped>
#cesiumContainer {
  width: 100%;
  height: 100%;
}
</style>