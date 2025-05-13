<script>
import CesiumViewer from './components/CesiumViewer.vue'
import Sidebar from './components/Sidebar.vue'

export default {
  name: 'App',
  components: {
    CesiumViewer,
    Sidebar
  },
  data() {
    return {
      viewer: null,
      is3D: true,
      currentImagery: 'default',
      currentTerrain: 'world',
      dataSources: {
        tileset: null,
        geojson: null,
        gitf: null
      },
      coordinates: {
        cartesian: null,
        cartographic: null
      },
      isViewerReady: false,
      isCoordinatePickingActive: false,
      currentAnalysis: null,
      currentCamera: {
        heading: 0,
        pitch: -90,
        roll: 0,
        height: 1000
      },
      currentGLTF: null,
      currentTileset: null,
      analysisEntities: [],
      windowPosition: { x: 20, y: 20 },
      isDragging: false,
      dragOffset: { x: 0, y: 0 },
      amapConfig: {
        key: '83e79e614efffc39c06078a8df40cd3a',
        poiTypes: {
          medical: '090000|090100|090101|090102',
          hospital: '090100|090101|090102',
          pharmacy: '090300',
          emergency: '090400'
        }
      }
    }
  },
  methods: {
    handleZoomIn() {
      this.$refs.cesiumViewer.zoomIn()
    },
    handleZoomOut() {
      this.$refs.cesiumViewer.zoomOut()
    },
    handleResetView() {
      this.$refs.cesiumViewer.resetView()
    },
    handleToggle3D() {
      this.$refs.cesiumViewer.toggle3D()
    },
    handleSwitchImagery(type) {
      console.log(`请求切换到图层: ${type}`);
      
      try {
        if (!this.$refs.cesiumViewer) {
          console.error('CesiumViewer组件未就绪，无法切换图层');
          return;
        }
        
        switch (type) {
          case 'default':
            console.log('切换到默认Cesium影像');
            this.$refs.cesiumViewer.switchImagery('default');
            break;
          case 'tianditu':
            console.log('请求加载天地图影像');
            this.$refs.cesiumViewer.loadTiandituImagery();
            break;
          case 'amap':
            console.log('请求加载高德地图影像');
            this.$refs.cesiumViewer.loadAmapImagery();
            break;
          default:
            console.warn(`未知的图层类型: ${type}`);
        }
        
        // 更新当前图层类型
        this.currentImagery = type;
        console.log(`当前图层已更新为: ${this.currentImagery}`);
      } catch (error) {
        console.error(`切换图层时发生错误: ${error.message}`, error);
      }
    },
    handleSwitchTerrain(type) {
      this.$refs.cesiumViewer.switchTerrain(type)
    },
    handleUpdateCamera(params) {
      this.$refs.cesiumViewer.setCameraView(params.heading, params.pitch, params.roll)
    },
    handleUpdateHeight(height) {
      this.$refs.cesiumViewer.setCameraHeight(height)
    },

    // 开始路径规划分析
    async startPathAnalysis() {
      this.currentAnalysis = 'path'
    },

    // 开始通视分析
    async startVisibilityAnalysis() {
      this.currentAnalysis = 'visibility'
    },

    // 开始可视域分析
    async startViewshedAnalysis() {
      this.currentAnalysis = 'viewshed'
    },

    // 开始缓冲区分析
    async startBufferAnalysis() {
      this.currentAnalysis = 'buffer'
    },

    // 获取路径规划结果
    async getRoutePath(startLon, startLat, endLon, endLat) {
      try {
        // 构建请求 URL
        const url = new URL('https://restapi.amap.com/v5/direction/walking');
        url.searchParams.append('key', this.amapConfig.key);
        url.searchParams.append('origin', `${startLon},${startLat}`);
        url.searchParams.append('destination', `${endLon},${endLat}`);
        url.searchParams.append('show_fields', 'polyline');

        console.log('路径规划 API 请求:', url.toString());

        // 发送请求
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== '1') {
          throw new Error(`路径规划失败: ${data.info}`);
        }

        if (!data.route || !data.route.paths || data.route.paths.length === 0) {
          throw new Error('未找到可行路径');
        }

        // 解析路径坐标
        const path = data.route.paths[0];
        if (!path.steps || path.steps.length === 0) {
          throw new Error('路径数据无效');
        }

        // 收集所有路径点
        const allPoints = [];
        for (const step of path.steps) {
          if (step.polyline) {
            const points = step.polyline.split(';').map(point => {
              const [lng, lat] = point.split(',').map(Number);
              return window.Cesium.Cartesian3.fromDegrees(lng, lat);
            });
            allPoints.push(...points);
          }
        }

        return {
          points: allPoints,
          distance: path.distance
        };
      } catch (error) {
        console.error('获取路径失败:', error);
        throw error;
      }
    },

    // 开始设施寻路分析
    async handleFacilitySearch(params) {
      if (!this.viewer) return;
      
      try {
        // 清除之前的分析结果
        this.clearAnalysisResults();

        // 创建起点标记
        const startPoint = this.viewer.entities.add({
          position: window.Cesium.Cartesian3.fromDegrees(params.startLon, params.startLat),
          point: {
            pixelSize: 12,
            color: window.Cesium.Color.GREEN,
            outlineColor: window.Cesium.Color.WHITE,
            outlineWidth: 2
          },
          label: {
            text: '起点',
            font: '14px sans-serif',
            fillColor: window.Cesium.Color.WHITE,
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new window.Cesium.Cartesian2(0, -10)
          }
        });
        this.analysisEntities.push(startPoint);

        // 搜索附近设施
        const facilities = await this.searchNearbyFacilities(params);
        
        if (!facilities || facilities.length === 0) {
          this.$refs.sidebar.updateFacilityResults([]);
          throw new Error('未找到符合条件的设施');
        }

        // 为每个设施创建标记和路径
        for (const facility of facilities) {
          // 创建设施点标记
          const facilityEntity = this.viewer.entities.add({
            position: window.Cesium.Cartesian3.fromDegrees(facility.longitude, facility.latitude),
          point: {
              pixelSize: 12,
              color: window.Cesium.Color.fromCssColorString(facility.color),
              outlineColor: window.Cesium.Color.WHITE,
              outlineWidth: 2
          },
          label: {
              text: `${facility.name}\n距离: ${(facility.distance / 1000).toFixed(2)}公里`,
            font: '14px sans-serif',
            fillColor: window.Cesium.Color.WHITE,
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new window.Cesium.Cartesian2(0, -10),
            showBackground: true,
            backgroundColor: window.Cesium.Color.BLACK.withAlpha(0.7)
          }
        });

          try {
            // 获取实际路径
            const routeResult = await this.getRoutePath(
              params.startLon,
              params.startLat,
              facility.longitude,
              facility.latitude
            );

            // 创建路径实体
            const pathEntity = this.viewer.entities.add({
          polyline: {
                positions: routeResult.points,
                width: 10,
                material: new window.Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.3,
                  taperPower: 0.5,
                  color: window.Cesium.Color.fromCssColorString('#FF0000').withAlpha(1)
                })
              }
            });

            // 更新设施信息中的实际步行距离
            facility.walkingDistance = routeResult.distance;

            // 将实体添加到分析结果中
            this.analysisEntities.push(facilityEntity, pathEntity);
          } catch (error) {
            console.error('获取路径失败:', error);
            // 如果获取实际路径失败，使用直线连接
            const pathEntity = this.viewer.entities.add({
              polyline: {
                positions: [
                  window.Cesium.Cartesian3.fromDegrees(params.startLon, params.startLat),
                  window.Cesium.Cartesian3.fromDegrees(facility.longitude, facility.latitude)
                ],
                width: 3,
                material: window.Cesium.Color.fromCssColorString('#FF0000').withAlpha(0.8)
              }
            });
            this.analysisEntities.push(facilityEntity, pathEntity);
          }
        }

        // 更新搜索结果显示
        this.$refs.sidebar.updateFacilityResults(facilities.map(f => ({
          ...f,
          walkingDistance: f.walkingDistance ? `步行距离: ${(f.walkingDistance / 1000).toFixed(2)}公里` : undefined
        })));

        // 调整视图以显示所有设施
        this.viewer.zoomTo(this.viewer.entities);

      } catch (error) {
        console.error('处理设施搜索失败:', error);
        alert(error.message || '处理设施搜索失败，请重试');
      }
    },

    // 搜索附近设施
    async searchNearbyFacilities(params) {
      try {
        console.log('开始搜索设施，参数:', params);

        // 构建请求 URL
        const url = new URL('https://restapi.amap.com/v5/place/around');
        url.searchParams.append('key', this.amapConfig.key);
        url.searchParams.append('keywords', params.facilityName);
        url.searchParams.append('location', `${params.startLon},${params.startLat}`);
        url.searchParams.append('radius', '10000'); // 10公里范围
        url.searchParams.append('page_size', '20'); // 增加返回数量
        url.searchParams.append('extensions', 'all'); // 返回完整的POI信息

        console.log('高德地图 API 请求:', url.toString());

        // 发送请求
        const response = await fetch(url);
        const data = await response.json();
        console.log('API 返回数据:', data);

        if (data.status !== '1') {
          throw new Error(`API 请求失败: ${data.info}`);
        }

        if (!data.pois || data.pois.length === 0) {
          console.log('未找到任何设施');
          return [];
        }

        // 处理返回的数据
        const facilities = data.pois.map(poi => {
          try {
            // 解析坐标
            const [longitude, latitude] = poi.location.split(',').map(Number);
            
            // 获取设施类型
            const type = this.getAmapFacilityType(poi.type);
            
            return {
              name: poi.name,
              type: type,
              longitude: longitude,
              latitude: latitude,
              color: this.getFacilityColor(type),
              distance: Number(poi.distance || 0),
              address: poi.address || '暂无地址信息',
              tel: poi.tel || '暂无电话信息',
              businessArea: poi.business_area || '暂无商圈信息'
            };
      } catch (error) {
            console.error('处理POI数据时出错:', error);
            return null;
          }
        }).filter(Boolean);

        console.log('处理后的设施数据:', facilities);

        // 按距离排序
        facilities.sort((a, b) => a.distance - b.distance);

        // 返回指定数量的最近设施
        const result = facilities.slice(0, params.count);
        console.log('返回的最终结果:', result);

        return result;

      } catch (error) {
        console.error('搜索设施失败:', error);
        throw error;
      }
    },

    // 获取高德地图设施类型
    getAmapFacilityType(typeCode) {
      const types = {
        '090100': '医院',
        '090101': '综合医院',
        '090102': '专科医院',
        '090200': '诊所',
        '090300': '药店',
        '090400': '急救中心',
        '090500': '疾控中心'
      };
      
      // 获取第一个匹配的类型代码
      const mainType = typeCode.split('|')[0];
      return types[mainType] || '医疗机构';
    },

    // 获取设施颜色
    getFacilityColor(type) {
      const colors = {
        '医院': '#FF0000',
        '综合医院': '#FF0000',
        '专科医院': '#FF4500',
        '诊所': '#FF6347',
        '药店': '#FFA500',
        '急救中心': '#FF0000',
        '疾控中心': '#FF7F50',
        '医疗机构': '#FFA07A'
      };
      return colors[type] || '#FF0000';
    },

    // 计算两点之间的距离（米）
    calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000; // 地球半径（米）
      const φ1 = this.toRadians(lat1);
      const φ2 = this.toRadians(lat2);
      const Δφ = this.toRadians(lat2 - lat1);
      const Δλ = this.toRadians(lon2 - lon1);

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c;
    },

    // 角度转弧度
    toRadians(degrees) {
      return degrees * Math.PI / 180;
    },

    // 检查两点间是否通视
    checkVisibility(observerCartesian, targetCartesian) {
      const scene = this.viewer.scene;
      
      // 计算观察点和目标点之间的距离
      const distance = window.Cesium.Cartesian3.distance(observerCartesian, targetCartesian);
      
      // 转换为地理坐标以计算高度差
      const observerCartographic = window.Cesium.Cartographic.fromCartesian(observerCartesian);
      const targetCartographic = window.Cesium.Cartographic.fromCartesian(targetCartesian);
      const heightDifference = targetCartographic.height - observerCartographic.height;
      
      // 计算坡度（角度）
      const slope = Math.atan2(heightDifference, distance) * (180 / Math.PI);
      
      // 使用地形检查是否有遮挡
      const ray = new window.Cesium.Ray(observerCartesian, 
        window.Cesium.Cartesian3.normalize(
          window.Cesium.Cartesian3.subtract(targetCartesian, observerCartesian, new window.Cesium.Cartesian3()),
          new window.Cesium.Cartesian3()
        )
      );
      
      const isVisible = !scene.globe.pick(ray, scene);
      
      return {
        isVisible,
        distance,
        heightDifference,
        slope
      };
    },

    // 计算可视域多边形顶点
    calculateViewshedPoints(lon, lat, height, radius, horizontalAngle, verticalAngle) {
      const points = [];
      const segments = 32;
      const angleStep = horizontalAngle / segments;
      const startAngle = -horizontalAngle / 2;
      
      // 计算扇形边界点
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i * angleStep);
        const point = this.calculateRayEndPoint(lon, lat, height, angle, verticalAngle, radius);
        points.push(point);
      }
      
      // 添加视点作为起始点，形成闭合多边形
      points.push(window.Cesium.Cartesian3.fromDegrees(lon, lat, height));
      
      return points;
    },

    // 计算射线终点
    calculateRayEndPoint(lon, lat, height, horizontalAngle, verticalAngle, radius) {
      const radianAngle = horizontalAngle * Math.PI / 180;
      const radianVertical = verticalAngle * Math.PI / 180;
      
      // 计算水平距离
      const horizontalDistance = radius * Math.cos(radianVertical);
      
      // 计算终点坐标
      const x = lon + (horizontalDistance * Math.cos(radianAngle)) / (111320 * Math.cos(lat * Math.PI / 180));
      const y = lat + (horizontalDistance * Math.sin(radianAngle)) / 111320;
      const z = height + radius * Math.sin(radianVertical);
      
      return window.Cesium.Cartesian3.fromDegrees(x, y, z);
    },

    // 计算缓冲区圆的顶点
    calculateBufferPoints(centerLon, centerLat, radius) {
      const points = [];
      const segments = 64;
      const angleStep = 360 / segments;
      
      for (let i = 0; i <= segments; i++) {
        const angle = i * angleStep;
        const point = this.calculateBufferPoint(centerLon, centerLat, radius, angle);
        points.push(point);
      }
      
      return points;
    },

    // 计算缓冲区上的点
    calculateBufferPoint(centerLon, centerLat, radius, angle) {
      const radianAngle = angle * Math.PI / 180;
      const x = centerLon + (radius * Math.cos(radianAngle)) / (111320 * Math.cos(centerLat * Math.PI / 180));
      const y = centerLat + (radius * Math.sin(radianAngle)) / 111320;
      return window.Cesium.Cartesian3.fromDegrees(x, y);
    },

    updateCameraParams() {
      if (this.viewer && this.viewer.camera) {
        const camera = this.viewer.camera;
        const cartographic = Cesium.Cartographic.fromCartesian(camera.position);
        
        this.currentCamera = {
          heading: Cesium.Math.toDegrees(camera.heading),
          pitch: Cesium.Math.toDegrees(camera.pitch),
          roll: Cesium.Math.toDegrees(camera.roll),
          height: cartographic.height
        };
      }
    },

    handleViewerReady(viewer) {
      console.log('Viewer ready event received')
      this.viewer = viewer
      this.isViewerReady = true
      console.log('Viewer is ready for data loading')
      
      this.updateCameraParams() // Initial camera params
      
      // 添加鼠标点击事件
      const handler = new window.Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
      handler.setInputAction((click) => {
        // 检查点击是否发生在控制面板上
        const controlPanel = document.querySelector('.floating-controls');
        const sidebar = document.querySelector('.sidebar');
        if (controlPanel || sidebar) {
          const controlRect = controlPanel?.getBoundingClientRect();
          const sidebarRect = sidebar?.getBoundingClientRect();
          const isClickInPanel = controlRect && (
            click.position.x >= controlRect.left && 
            click.position.x <= controlRect.right && 
            click.position.y >= controlRect.top && 
            click.position.y <= controlRect.bottom
          );
          const isClickInSidebar = sidebarRect && (
            click.position.x >= sidebarRect.left &&
            click.position.x <= sidebarRect.right &&
            click.position.y >= sidebarRect.top &&
            click.position.y <= sidebarRect.bottom
          );
          
          // 如果点击在控制面板或侧边栏内，不处理地图点击事件
          if (isClickInPanel || isClickInSidebar) {
            return;
          }
        }

        const scene = this.viewer.scene
        
        // 使用 pickPosition 获取点击位置的笛卡尔坐标
        const cartesian = scene.pickPosition(click.position)
        console.log('点击位置:', click.position)
        console.log('是否支持pickPosition:', scene.pickPositionSupported)
        console.log('是否支持地形深度测试:', scene.globe.depthTestAgainstTerrain)
        
        if (window.Cesium.defined(cartesian)) {
          // 将笛卡尔坐标转换为地理坐标
          const cartographic = window.Cesium.Cartographic.fromCartesian(cartesian)
          let longitude = window.Cesium.Math.toDegrees(cartographic.longitude)
          let latitude = window.Cesium.Math.toDegrees(cartographic.latitude)
          const height = cartographic.height

          // 根据当前底图类型进行坐标转换
          let transformedCoords;
          if (this.currentImagery === 'amap') {
            // 如果是高德地图，将WGS84坐标转换为GCJ02坐标
            transformedCoords = this.transformCoordinates(longitude, latitude, 'WGS84', 'GCJ02');
            longitude = transformedCoords.longitude;
            latitude = transformedCoords.latitude;
            console.log('转换为高德坐标系(GCJ02):', transformedCoords);
          } else {
            // 如果是其他地图（Cesium、天地图），使用WGS84坐标
            console.log('使用WGS84坐标系');
          }

          console.log('获取到的笛卡尔坐标:', cartesian)
          console.log('转换后的地理坐标:', {
            longitude: longitude.toFixed(6),
            latitude: latitude.toFixed(6),
            height: height.toFixed(2),
            coordinateSystem: this.currentImagery === 'amap' ? 'GCJ02' : 'WGS84'
          })

          const newCoordinates = {
            cartesian: {
              x: cartesian.x.toFixed(2),
              y: cartesian.y.toFixed(2),
              z: cartesian.z.toFixed(2)
            },
            cartographic: {
              longitude: longitude.toFixed(6),
              latitude: latitude.toFixed(6),
              height: height.toFixed(2)
            }
          }

          // 更新坐标显示
          this.coordinates = newCoordinates

          // 在点击位置添加标记点和标注
          const entity = this.viewer.entities.add({
            position: cartesian,
            point: {
              color: window.Cesium.Color.YELLOW,
              pixelSize: 10,
              outlineColor: window.Cesium.Color.BLACK,
              outlineWidth: 2,
              heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
              text: `经度: ${longitude.toFixed(4)}°\n纬度: ${latitude.toFixed(4)}°\n高度: ${height.toFixed(2)}m`,
              font: '14px sans-serif',
              fillColor: window.Cesium.Color.WHITE,
              outlineColor: window.Cesium.Color.BLACK,
              outlineWidth: 2,
              style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new window.Cesium.Cartesian2(0, -10),
              showBackground: true,
              backgroundColor: window.Cesium.Color.BLACK.withAlpha(0.7),
              heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });

          // 检查是否点击到3D Tiles
          const pickedObject = scene.pick(click.position)
          if (window.Cesium.defined(pickedObject)) {
            console.log('点击到3D Tiles对象:', pickedObject)
          } else {
            console.log('点击到地形或椭球体表面')
          }
        } else {
          console.log('未能获取到有效坐标')
        }
      }, window.Cesium.ScreenSpaceEventType.LEFT_CLICK)

      // 添加相机变化监听
      this.viewer.camera.changed.addEventListener(() => {
        this.updateCameraParams()
      })
      this.viewer.camera.percentageChanged = 0.1 // 设置相机变化阈值
    },
    checkViewerReady() {
      if (!this.isViewerReady || !this.viewer) {
        console.error('Viewer is not ready')
        return false
      }
      return true
    },
    async load3DTiles(assetId) {
      if (!this.viewer) {
        console.error('Viewer is not initialized');
        return;
      }

      try {
        // 清除现有的3D Tiles
        this.clear3DTiles();
        
        console.log('开始加载3D Tiles，assetId:', assetId);

        const tileset = this.viewer.scene.primitives.add(
            await window.Cesium.Cesium3DTileset.fromIonAssetId(assetId)
        );

        // 缓存当前tileset以便后续清除
        this.currentTileset = tileset;

        // 自动调整视角以显示整个模型
        await tileset.readyPromise;
        this.viewer.zoomTo(tileset);
        
      } catch (error) {
        console.error('加载3D Tiles失败:', error);
        this.clear3DTiles();
        alert(`加载3D Tiles失败: ${error.message}`);
      }
    },
    async load3DTilesLocal(tilesetPath) {
      if (!this.viewer || !this.isViewerReady) {
        console.warn('Viewer is not ready');
        return;
      }

      try {
        // 清除现有的3D Tiles
        this.clear3DTiles();

        // 加载本地tileset
        const tileset = await window.Cesium.Cesium3DTileset.fromUrl(tilesetPath);
        this.viewer.scene.primitives.add(tileset);
        this.currentTileset = tileset;

        // 等待tileset加载完成并定位视角
        await tileset.readyPromise;
        this.viewer.zoomTo(tileset);

      } catch (error) {
        console.error('加载3D Tiles失败:', error);
      }
    },
    async loadGeoJSON(file, styleSettings) {
      if (!this.checkViewerReady()) return

      // 清除任何残留的图例
      this.clearLegend();

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const geojson = JSON.parse(e.target.result)
          console.log('GeoJSON data loaded:', geojson)

          // 清除现有的实体和数据源
          this.clearGeoJSON()

          // 添加 GeoJSON 数据
          const dataSource = new window.Cesium.GeoJsonDataSource()
          
          dataSource.load(geojson, {
            clampToGround: true,
            stroke: window.Cesium.Color.WHITE,
            fill: window.Cesium.Color.BLUE.withAlpha(0.3),
            strokeWidth: 2
          }).then(dataSource => {
            // 先添加到viewer
            this.viewer.dataSources.add(dataSource)
            this.dataSources.geojson = dataSource

            // 处理每个实体，添加标注
            dataSource.entities.values.forEach(entity => {
              if (entity.properties) {
                const name = entity.properties.name?._value
                const height = entity.properties.height?._value || 0
                const type = entity.properties.type?._value
                
                if (name) {
                  let centerCartesian
                  
                  if (entity.polygon) {
                    // 计算多边形中心点
                    const positions = entity.polygon.hierarchy.getValue().positions
                    centerCartesian = window.Cesium.BoundingSphere.fromPoints(positions).center
                  } else if (entity.polyline) {
                    // 计算线的中点
                    const positions = entity.polyline.positions.getValue()
                    const midIndex = Math.floor(positions.length / 2)
                    centerCartesian = positions[midIndex]
                  } else if (entity.position) {
                    // 点实体直接使用其位置
                    centerCartesian = entity.position.getValue()
                  }
                  
                  if (centerCartesian) {
                    // 创建标注实体
                    const labelEntity = this.viewer.entities.add({
                      position: centerCartesian,
                      label: {
                        text: `${name}\n高度: ${height}米${type ? '\n类型: ' + type : ''}`,
                        font: '16px sans-serif',
                        fillColor: window.Cesium.Color.WHITE,
                        outlineColor: window.Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
                        horizontalOrigin: window.Cesium.HorizontalOrigin.CENTER,
                        pixelOffset: new window.Cesium.Cartesian2(0, -10),
                        heightReference: window.Cesium.HeightReference.RELATIVE_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        showBackground: true,
                        backgroundColor: window.Cesium.Color.BLACK.withAlpha(0.7),
                        backgroundPadding: new window.Cesium.Cartesian2(7, 5)
                      }
                    })
                    
                    // 将标注实体与原实体关联
                    if (!entity._labelEntity) {
                      entity._labelEntity = labelEntity
                    }
                  }
                }
              }
            })

            // 应用样式设置
            this.applyGeoJSONStyle(dataSource, styleSettings)
            
            // 先尝试计算GeoJSON的边界，以便更精确地定位
            if (dataSource.entities.values.length > 0) {
              console.log('调整视图到GeoJSON数据区域...');
              
              try {
                // 使用更可靠的flyTo方法，确保视图变化明显
                this.viewer.flyTo(dataSource, {
                  duration: 1.5,
                  offset: new window.Cesium.HeadingPitchRange(
                    0,
                    window.Cesium.Math.toRadians(-45), // 俯视角度
                    0 // 距离会自动计算
                  )
                }).then(() => {
                  console.log('相机已移动到GeoJSON数据上方');
                }).catch(error => {
                  console.error('使用flyTo失败，尝试使用zoomTo:', error);
                  // 如果flyTo失败，回退到zoomTo
                  this.viewer.zoomTo(dataSource);
                });
              } catch (error) {
                console.error('相机定位到GeoJSON数据失败:', error);
                // 最后的尝试：使用更简单的方法
                try {
                  this.viewer.zoomTo(dataSource);
                } catch (zoomError) {
                  console.error('所有相机定位方法都失败:', zoomError);
                }
              }
            } else {
              console.warn('GeoJSON数据无实体，无法调整视图');
            }
          }).catch(error => {
            console.error('Error loading GeoJSON:', error)
          })
        } catch (error) {
          console.error('Error parsing GeoJSON:', error)
        }
      }
      reader.readAsText(file)
    },
    applyGeoJSONStyle(dataSource, styleSettings) {
      if (!dataSource || !styleSettings) {
        console.error('applyGeoJSONStyle: 缺少必要参数', { dataSource, styleSettings });
        return;
      }

      console.log('应用GeoJSON样式:', styleSettings);

      const { renderSettings, height } = styleSettings;
      if (!renderSettings) {
        console.error('applyGeoJSONStyle: 缺少渲染设置', styleSettings);
        return;
      }

      const baseHeight = height?.baseHeight || 0;
      const heightScale = height?.heightScale || 1;
      
      // 记录处理的实体数量，用于调试
      let processedCount = 0;
      let colorAppliedCount = 0;

      // 处理每个实体
      dataSource.entities.values.forEach(entity => {
        if (!entity.properties) return;
        processedCount++;

        // 获取选定字段的值和其他属性
        const fieldValue = entity.properties[renderSettings.field]?._value;
        const propertyHeight = entity.properties.height?._value || 0;
        const name = entity.properties.name?._value;
        
        // 应用颜色（如果存在多边形）
        if (entity.polygon) {
          let color;
          let colorApplied = false;
          
          // 根据渲染模式和字段值设置颜色
          if (renderSettings.field && fieldValue !== undefined) {
            if (renderSettings.mode === 'category') {
              // 分类渲染
              const colorSetting = renderSettings.categoryColors[fieldValue];
              if (colorSetting) {
                color = window.Cesium.Color.fromCssColorString(colorSetting.value)
                  .withAlpha(colorSetting.alpha);
                colorApplied = true;
              }
            }
          }
          
          // 如果无法应用颜色，使用默认颜色
          if (!colorApplied) {
            color = window.Cesium.Color.GRAY.withAlpha(0.6);
          } else {
            colorAppliedCount++;
          }
          
          // 应用颜色到实体
          entity.polygon.material = color;
          
          // 设置多边形高度
          const finalHeight = baseHeight + (propertyHeight * heightScale);
          if (finalHeight > 0) {
            entity.polygon.extrudedHeight = finalHeight;
            entity.polygon.extrudedHeightReference = window.Cesium.HeightReference.RELATIVE_TO_GROUND;
          } else {
            entity.polygon.extrudedHeight = undefined;
          }
          
          // 更新标签文本
          if (name && entity._labelEntity) {
            let labelText = `${name}`;
            if (renderSettings.field && fieldValue !== undefined) {
              labelText += `\n${renderSettings.field}: ${fieldValue}`;
            }
            if (finalHeight > 0) {
              labelText += `\n高度: ${finalHeight.toFixed(1)}米`;
            }
            entity._labelEntity.label.text = labelText;
          }
        }
      });
      
      console.log(`样式应用完成: 处理了 ${processedCount} 个实体，应用颜色 ${colorAppliedCount} 次`);
    },
    updateGeoJSONStyle(styleSettings) {
      if (!this.dataSources.geojson) return
      
      // 清除任何残留的图例
      this.clearLegend();
      
      console.log('Updating GeoJSON style with:', styleSettings)
      
      // 应用分色渲染
      this.applyGeoJSONStyle(this.dataSources.geojson, styleSettings)
      
      // 当高度改变时，调整视图以适应新的高度
      const { height } = styleSettings
      if (height && (height.baseHeight > 0 || height.heightScale > 1)) {
        // 使用轻微延迟，确保样式应用后再调整视图
        setTimeout(() => {
          if (this.viewer && this.dataSources.geojson) {
            try {
              // 尝试调整视图
              this.viewer.flyTo(this.dataSources.geojson, {
                duration: 1,
                offset: new window.Cesium.HeadingPitchRange(
                  0,
                  window.Cesium.Math.toRadians(-35), // 稍微倾斜的视角以便查看高度
                  0
                )
              }).catch(error => {
                console.error('更新样式后调整视图失败:', error);
              });
            } catch (error) {
              console.error('更新样式后调整视图出错:', error);
            }
          }
        }, 300); // 短暂延迟，确保样式完全应用
      }
    },
    async loadGITF(modelPath, modelProperties = null) {
      if (!this.viewer || !this.isViewerReady) {
        console.warn('Viewer is not ready');
        return;
      }

      try {
        // 清除现有的模型
        this.clearGITF();

        // 使用提供的属性或默认值
        const properties = modelProperties || {
          longitude: -123.0744619,
          latitude: 44.0503706,
          height: 0,
          scale: 1.0,
          heading: 45.0,
          pitch: 15.0,
          roll: 0.0
        };

        const position = Cesium.Cartesian3.fromDegrees(
          properties.longitude,
          properties.latitude,
          properties.height
        );
        
        const heading = Cesium.Math.toRadians(properties.heading);
        const pitch = Cesium.Math.toRadians(properties.pitch);
        const roll = Cesium.Math.toRadians(properties.roll);
        
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          position,
          new Cesium.HeadingPitchRoll(heading, pitch, roll)
        );

        const entity = this.viewer.entities.add({
          position: position,
          orientation: orientation,
          model: {
            uri: modelPath,
            scale: properties.scale,
            minimumPixelSize: 128,
            maximumScale: 20000
          },
        });
        this.viewer.trackedEntity = entity;

        // 等待模型加载完成
        await entity.readyPromise;

        // 缓存当前实体以便后续清除
        this.currentGLTF = entity;

        // 视角定位到模型
        this.viewer.zoomTo(entity, new Cesium.HeadingPitchRange(0, -20, 100));

      } catch (error) {
        console.error('加载GLTF模型失败:', error);
      }
    },
    clear3DTiles() {
      try {
        if (this.currentTileset) {
          console.log('清除现有的3D Tiles');
          this.viewer.scene.primitives.remove(this.currentTileset);
          this.currentTileset = null;
          console.log('3D Tiles已清除');
        }
      } catch (error) {
        console.error('清除3D Tiles时出错:', error);
      }
    },
    clearGeoJSON() {
      if (this.viewer) {
        // 清除所有实体和数据源
        if (this.dataSources.geojson) {
          // 清除关联的标注实体
          this.dataSources.geojson.entities.values.forEach(entity => {
            if (entity._labelEntity) {
              this.viewer.entities.remove(entity._labelEntity);
              delete entity._labelEntity;
            }
          });
          this.viewer.dataSources.remove(this.dataSources.geojson);
        }
        this.dataSources.geojson = null;
        console.log('GeoJSON cleared');
      }
    },
    clearGITF() {
      if (this.currentGLTF) {
        this.viewer.entities.remove(this.currentGLTF);
        this.currentGLTF = null;
      }
    },
    handleUpdateCoordinates(coordinates) {
      this.coordinates = coordinates
    },
    handleClearMarkers() {
      if (this.viewer) {
        // 获取所有实体
        const entities = this.viewer.entities.values
        // 遍历并移除所有标记点
        for (let i = entities.length - 1; i >= 0; i--) {
          const entity = entities[i]
          if (entity.point) { // 检查是否是标记点
            this.viewer.entities.remove(entity)
          }
        }
        console.log('所有标记点已清除')
      }
    },
    handleCoordinatePickingChange(isActive) {
      this.isCoordinatePickingActive = isActive
      if (!isActive) {
        this.handleClearMarkers()
      }
    },
    handleFlyToLocation({ lat, lon, height }) {
      if (!this.viewer || !this.isViewerReady) return;
      
      try {
        // 转换为Cesium坐标
        const destination = Cesium.Cartesian3.fromDegrees(lon, lat, height);
        
        // 飞行到目标位置
        this.viewer.camera.flyTo({
          destination,
          duration: 2,
          complete: () => {
            // 更新相机参数
            this.updateCameraParams();
          }
        });
      } catch (error) {
        console.error('飞行到目标位置失败:', error);
      }
    },
    // 清除分析结果
    clearAnalysisResults() {
      if (this.viewer) {
        // 清除所有分析实体
        if (this.analysisEntities && this.analysisEntities.length > 0) {
          this.analysisEntities.forEach(entity => {
            if (entity && this.viewer.entities.contains(entity)) {
              this.viewer.entities.remove(entity);
            }
          });
          this.analysisEntities = [];
        }
        
        // 遍历所有实体，查找并清除分析相关的实体
        const entitiesToRemove = [];
        this.viewer.entities.values.forEach(entity => {
          // 检查实体是否属于分析结果
          if (entity.label && entity.label.text) {
            const text = entity.label.text.getValue();
            if (text.includes('起点') || 
                text.includes('终点') || 
                text.includes('观察点') ||
                text.includes('目标点') ||
                text.includes('可视域') ||
                text.includes('缓冲区') ||
                text.includes('距离:') ||
                text.includes('步行距离:')) {
              entitiesToRemove.push(entity);
            }
          }
          
          // 检查是否为路径实体
          if (entity.polyline) {
            entitiesToRemove.push(entity);
          }
          
          // 检查是否为点实体
          if (entity.point) {
            entitiesToRemove.push(entity);
          }
          
          // 检查是否为缓冲区或可视域
          if (entity.ellipse || entity.polygon) {
            entitiesToRemove.push(entity);
          }
        });
        
        // 删除这些实体
        entitiesToRemove.forEach(entity => {
          this.viewer.entities.remove(entity);
        });
      }
      
      // 重置当前分析类型
      this.currentAnalysis = null;
    },
    startDrag(event) {
      // 只在鼠标左键点击时开始拖动
      if (event.button === 0) {
        this.isDragging = true;
        this.dragOffset = {
          x: event.clientX - this.windowPosition.x,
          y: event.clientY - this.windowPosition.y
        };
        
        // 添加全局鼠标事件监听
        document.addEventListener('mousemove', this.handleDrag);
        document.addEventListener('mouseup', this.stopDrag);
      }
    },
    handleDrag(event) {
      if (this.isDragging) {
        event.preventDefault();
        this.windowPosition = {
          x: event.clientX - this.dragOffset.x,
          y: event.clientY - this.dragOffset.y
        };
      }
    },
    stopDrag() {
      this.isDragging = false;
      // 移除全局鼠标事件监听
      document.removeEventListener('mousemove', this.handleDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    // 坐标转换工具函数
    transformCoordinates(longitude, latitude, fromType, toType) {
      // 如果源和目标坐标系相同，直接返回
      if (fromType === toType) {
        return { longitude, latitude };
      }

      // WGS84 到 GCJ02（高德）的转换
      if (fromType === 'WGS84' && toType === 'GCJ02') {
        const PI = 3.14159265358979324;
        const a = 6378245.0;
        const ee = 0.00669342162296594323;

        let wgLat = latitude;
        let wgLon = longitude;

        if (this.outOfChina(wgLat, wgLon)) {
          return { longitude, latitude };
        }

        let dLat = this.transformLat(wgLon - 105.0, wgLat - 35.0);
        let dLon = this.transformLon(wgLon - 105.0, wgLat - 35.0);

        const radLat = wgLat / 180.0 * PI;
        let magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;

        const sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
        dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);

        const gcjLat = wgLat + dLat;
        const gcjLon = wgLon + dLon;

        return {
          latitude: gcjLat,
          longitude: gcjLon
        };
      }

      // GCJ02（高德）到 WGS84 的转换
      if (fromType === 'GCJ02' && toType === 'WGS84') {
        const PI = 3.14159265358979324;
        const a = 6378245.0;
        const ee = 0.00669342162296594323;

        let gcjLat = latitude;
        let gcjLon = longitude;

        if (this.outOfChina(gcjLat, gcjLon)) {
          return { longitude, latitude };
        }

        let dLat = this.transformLat(gcjLon - 105.0, gcjLat - 35.0);
        let dLon = this.transformLon(gcjLon - 105.0, gcjLat - 35.0);

        const radLat = gcjLat / 180.0 * PI;
        let magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;

        const sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
        dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);

        const wgLat = gcjLat - dLat;
        const wgLon = gcjLon - dLon;

        return {
          latitude: wgLat,
          longitude: wgLon
        };
      }

      // 如果没有匹配的转换，返回原始坐标
      return { longitude, latitude };
    },

    // 判断坐标是否在中国境内
    outOfChina(lat, lon) {
      if (lon < 72.004 || lon > 137.8347) {
        return true;
      }
      if (lat < 0.8293 || lat > 55.8271) {
        return true;
      }
      return false;
    },

    // 转换纬度
    transformLat(x, y) {
      let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
      ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
      ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
      return ret;
    },

    // 转换经度
    transformLon(x, y) {
      let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
      ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
      ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
      return ret;
    },

    // 处理GeoJSON视图更新
    handleUpdateGeoJSONView() {
      if (!this.viewer || !this.dataSources.geojson) {
        console.error('无法更新GeoJSON视图：viewer或数据源不存在');
        return;
      }
      
      console.log('更新GeoJSON视图...');
      
      // 检查datasource是否有实体
      const entities = this.dataSources.geojson.entities.values;
      if (entities.length === 0) {
        console.warn('GeoJSON数据源没有实体，无法调整视图');
        return;
      }
      
      try {
        // 创建一个临时实体集合，用于zoomTo
        const entityCollection = new window.Cesium.EntityCollection();
        entities.forEach(entity => {
          if (entity.polygon) {
            entityCollection.add(entity);
          }
        });
        
        if (entityCollection.values.length === 0) {
          console.warn('未找到多边形实体，尝试使用所有实体');
          // 如果没有多边形实体，使用所有实体
          this.viewer.flyTo(this.dataSources.geojson, {
            duration: 1.5,
            offset: new window.Cesium.HeadingPitchRange(
              0, 
              window.Cesium.Math.toRadians(-40),
              0
            )
          }).catch(error => {
            console.error('飞行到GeoJSON数据失败，尝试使用zoomTo:', error);
            this.viewer.zoomTo(this.dataSources.geojson);
          });
        } else {
          console.log(`使用 ${entityCollection.values.length} 个多边形实体进行视图定位`);
          // 先尝试使用flyTo
          this.viewer.flyTo(entityCollection, {
            duration: 1.5,
            offset: new window.Cesium.HeadingPitchRange(
              0, 
              window.Cesium.Math.toRadians(-40),
              0
            )
          }).catch(error => {
            console.error('使用flyTo失败，尝试使用zoomTo:', error);
            // 如果flyTo失败，使用zoomTo
            this.viewer.zoomTo(entityCollection);
          });
        }
      } catch (error) {
        console.error('相机定位失败:', error);
        // 最后的尝试：使用直接更改相机位置
        try {
          // 获取第一个实体的位置作为备选
          const firstEntity = entities[0];
          if (firstEntity && firstEntity.polygon) {
            const positions = firstEntity.polygon.hierarchy.getValue().positions;
            const center = window.Cesium.BoundingSphere.fromPoints(positions).center;
            const cartographic = window.Cesium.Cartographic.fromCartesian(center);
            const longitude = window.Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = window.Cesium.Math.toDegrees(cartographic.latitude);
            
            // 设置相机位置
            this.viewer.camera.flyTo({
              destination: window.Cesium.Cartesian3.fromDegrees(longitude, latitude, 2000),
              orientation: {
                heading: 0,
                pitch: window.Cesium.Math.toRadians(-50),
                roll: 0
              }
            });
          }
        } catch (error2) {
          console.error('所有相机定位方法都失败:', error2);
        }
      }
    },

    // 清除图例元素
    clearLegend() {
      const oldLegend = document.querySelector('.geojson-legend');
      if (oldLegend) {
        oldLegend.remove();
        console.log('已清除GeoJSON图例');
      }
    },
  },
  mounted() {
    // 清除任何残留的图例
    this.clearLegend();
  },
  beforeDestroy() {
    if (this.viewer) {
      this.viewer.camera.changed.removeEventListener(() => {
        this.updateCameraParams()
      })
    }
  }
}
</script>

<template>
  <div class="app-container">
    <div class="sidebar">
      <Sidebar 
        ref="sidebar"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @reset-view="handleResetView"
        @toggle-3d="handleToggle3D"
        @switch-imagery="handleSwitchImagery"
        @switch-terrain="handleSwitchTerrain"
        @update-camera="handleUpdateCamera"
        @update-height="handleUpdateHeight"
        @load-3dtiles="load3DTiles"
        @load-3dtiles-local="load3DTilesLocal"
        @load-geojson="loadGeoJSON"
        @load-gitf="loadGITF"
        @clear-3dtiles="clear3DTiles"
        @clear-geojson="clearGeoJSON"
        @clear-gitf="clearGITF"
        @update-coordinates="handleUpdateCoordinates"
        @coordinate-picking-change="handleCoordinatePickingChange"
        @fly-to-location="handleFlyToLocation"
        @update-geojson-style="updateGeoJSONStyle"
        @update-geojson-view="handleUpdateGeoJSONView"
        @run-path-analysis="handlePathAnalysis"
        @run-visibility-analysis="handleVisibilityAnalysis"
        @run-viewshed-analysis="handleViewshedAnalysis"
        @run-buffer-analysis="handleBufferAnalysis"
        @run-facility-search="handleFacilitySearch"
        @clear-analysis="clearAnalysisResults"
        :coordinates="coordinates"
        :current-camera="currentCamera"
      />
    </div>
    <div class="main-content">
      <CesiumViewer ref="cesiumViewer" @viewer-ready="handleViewerReady" />
      <div class="bottom-bar">
        <div class="coordinates-display">
          <div class="coordinate-section">
            <span class="coordinate-label">笛卡尔坐标：</span>
            <span v-if="coordinates.cartesian">
              X:{{ coordinates.cartesian.x }} Y:{{ coordinates.cartesian.y }} Z:{{ coordinates.cartesian.z }}
            </span>
            <span v-else>未获取到坐标</span>
          </div>
          
          <div class="coordinate-section">
            <span class="coordinate-label">地理坐标：</span>
            <span v-if="coordinates.cartographic">
              经度:{{ coordinates.cartographic.longitude }}° 纬度:{{ coordinates.cartographic.latitude }}° 高度:{{ coordinates.cartographic.height }}米
            </span>
            <span v-else>未获取到坐标</span>
          </div>
          
          <el-button 
            type="primary" 
            size="small" 
            @click="handleClearMarkers"
            class="clear-markers-button"
          >
            清除标记点
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100vh;
  background-color: #2c3e50;
  border-right: 1px solid #34495e;
  overflow: hidden;
  position: relative;
}

.main-content {
  flex: 1;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #2c3e50;
  padding: 5px 10px;
  border-top: 1px solid #34495e;
  z-index: 999;
  height: 60px;
}

.bottom-bar .coordinates-display {
  background-color: #34495e;
  padding: 5px 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.bottom-bar .coordinate-section {
  flex: 1;
  margin-right: 20px;
  display: flex;
  align-items: center;
}

.bottom-bar .coordinate-label {
  color: #ecf0f1;
  font-size: 12px;
  font-weight: bold;
  margin-right: 5px;
  white-space: nowrap;
}

.bottom-bar .coordinates-display span {
  color: #ecf0f1;
  font-size: 11px;
  line-height: 1.2;
}

.bottom-bar .coordinates-display .clear-markers-button {
  margin-left: 20px;
  padding: 5px 10px;
  font-size: 12px;
  height: 28px;
  line-height: 1;
  background-color: #3498db;
  border-color: #3498db;
}

.bottom-bar .coordinates-display .clear-markers-button:hover {
  background-color: #2980b9;
  border-color: #2980b9;
}

.floating-controls {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: rgba(44, 62, 80, 0.8);
  border-radius: 8px;
  padding: 15px;
  z-index: 1000;
  color: #ecf0f1;
  min-width: 250px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.floating-controls .drag-handle {
  cursor: move;
  padding: 5px;
  margin: -15px -15px 10px -15px;
  background-color: rgba(52, 73, 94, 0.8);
  border-radius: 8px 8px 0 0;
  user-select: none;
}

.floating-controls .controls-content {
  pointer-events: auto;
}

.floating-controls .el-slider {
  pointer-events: auto;
}

.floating-controls .el-slider__runway {
  pointer-events: auto;
}

.floating-controls .el-slider__button-wrapper {
  pointer-events: auto;
}

.floating-controls .el-slider__button {
  pointer-events: auto;
}

.floating-controls .control-group {
  margin-bottom: 15px;
}

.floating-controls .control-group:last-child {
  margin-bottom: 0;
}

.floating-controls label {
  display: block;
  margin-bottom: 5px;
  color: #ecf0f1;
  font-size: 12px;
}

.floating-controls .el-button {
  margin: 5px;
  font-size: 12px;
}
</style>
