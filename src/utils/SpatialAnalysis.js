// 空间分析工具类
export class SpatialAnalysis {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = [];
  }

  // 清除所有分析结果
  clearAnalysis() {
    // 清除所有分析实体
    this.entities.forEach(entity => {
      if (entity && this.viewer.entities.contains(entity)) {
        this.viewer.entities.remove(entity);
      }
    });
    this.entities = [];
  }

  // 路径规划分析
  async pathAnalysis(startPoint, endPoint) {
    this.clearAnalysis();

    // 创建起点和终点标记
    const startEntity = this.viewer.entities.add({
      position: window.Cesium.Cartesian3.fromDegrees(startPoint.longitude, startPoint.latitude),
      point: {
        color: window.Cesium.Color.GREEN,
        pixelSize: 10,
        outlineColor: window.Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: '起点',
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM
      }
    });

    const endEntity = this.viewer.entities.add({
      position: window.Cesium.Cartesian3.fromDegrees(endPoint.longitude, endPoint.latitude),
      point: {
        color: window.Cesium.Color.RED,
        pixelSize: 10,
        outlineColor: window.Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: '终点',
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM
      }
    });

    // 创建路径线
    const pathEntity = this.viewer.entities.add({
      polyline: {
        positions: [startEntity.position.getValue(), endEntity.position.getValue()],
        width: 3,
        material: new window.Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: window.Cesium.Color.YELLOW
        })
      }
    });

    this.entities.push(startEntity, endEntity, pathEntity);
    await this.viewer.zoomTo(pathEntity);

    // 使用EllipsoidGeodesic计算地表距离
    const startCartographic = window.Cesium.Cartographic.fromDegrees(
      startPoint.longitude,
      startPoint.latitude
    );
    const endCartographic = window.Cesium.Cartographic.fromDegrees(
      endPoint.longitude,
      endPoint.latitude
    );

    const geodesic = new window.Cesium.EllipsoidGeodesic(
      startCartographic,
      endCartographic
    );

    // 获取地表距离（米）
    const distance = geodesic.surfaceDistance;

    return { distance };
  }

  // 通视分析
  async visibilityAnalysis(observerPoint, targetPoint) {
    this.clearAnalysis();

    const observerCartesian = window.Cesium.Cartesian3.fromDegrees(
      observerPoint.longitude,
      observerPoint.latitude,
      observerPoint.height
    );
    const targetCartesian = window.Cesium.Cartesian3.fromDegrees(
      targetPoint.longitude,
      targetPoint.latitude,
      targetPoint.height
    );

    // 创建观察点和目标点
    const observerEntity = this.viewer.entities.add({
      position: observerCartesian,
      point: {
        color: window.Cesium.Color.BLUE,
        pixelSize: 10,
        outlineColor: window.Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: '观察点',
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM
      }
    });

    const targetEntity = this.viewer.entities.add({
      position: targetCartesian,
      point: {
        color: window.Cesium.Color.YELLOW,
        pixelSize: 10,
        outlineColor: window.Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: '目标点',
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM
      }
    });

    // 创建视线
    const lineEntity = this.viewer.entities.add({
      polyline: {
        positions: [observerCartesian, targetCartesian],
        width: 2,
        material: window.Cesium.Color.RED.withAlpha(0.5)
      }
    });

    this.entities.push(observerEntity, targetEntity, lineEntity);
    await this.viewer.zoomTo(lineEntity);

    // 检查地形遮挡
    const samples = 100;
    const positions = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      positions.push(window.Cesium.Cartesian3.lerp(observerCartesian, targetCartesian, t, new window.Cesium.Cartesian3()));
    }

    // 获取地形高度
    const terrainSamplePositions = await window.Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider, positions.map(pos => {
      const cartographic = window.Cesium.Cartographic.fromCartesian(pos);
      return cartographic;
    }));

    // 检查是否有遮挡
    let isVisible = true;
    const observerHeight = observerPoint.height;
    const targetHeight = targetPoint.height;

    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const expectedHeight = observerHeight + (targetHeight - observerHeight) * t;
      const terrainHeight = terrainSamplePositions[i].height;

      if (terrainHeight > expectedHeight) {
        isVisible = false;
        break;
      }
    }

    return { isVisible };
  }

  // 可视域分析
  async viewshedAnalysis(viewerPoint, horizontalAngle, verticalAngle, radius) {
    this.clearAnalysis();

    // 创建视点
    const viewerEntity = this.viewer.entities.add({
      position: window.Cesium.Cartesian3.fromDegrees(
        viewerPoint.longitude,
        viewerPoint.latitude,
        viewerPoint.height
      ),
      point: {
        color: window.Cesium.Color.RED,
        pixelSize: 10,
        outlineColor: window.Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: '视点',
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM
      }
    });

    // 创建可视域范围
    const positions = [];
    const segments = 32;
    const angleStep = horizontalAngle / segments;
    const startAngle = -horizontalAngle / 2;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i * angleStep);
      const radianAngle = angle * Math.PI / 180;

      const x = viewerPoint.longitude + (radius * Math.cos(radianAngle)) / (111320 * Math.cos(viewerPoint.latitude * Math.PI / 180));
      const y = viewerPoint.latitude + (radius * Math.sin(radianAngle)) / 111320;

      positions.push(window.Cesium.Cartesian3.fromDegrees(x, y));
    }

    // 添加中心点
    positions.push(window.Cesium.Cartesian3.fromDegrees(viewerPoint.longitude, viewerPoint.latitude));

    const viewshedEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new window.Cesium.PolygonHierarchy(positions),
        material: window.Cesium.Color.GREEN.withAlpha(0.3),
        outline: true,
        outlineColor: window.Cesium.Color.GREEN,
        outlineWidth: 2
      }
    });

    this.entities.push(viewerEntity, viewshedEntity);
    await this.viewer.zoomTo(this.viewer.entities);

    return { viewshedEntity };
  }

  // 缓冲区分析
  async bufferAnalysis(centerPoint, radius) {
    this.clearAnalysis();

    // 创建中心点
    const centerEntity = this.viewer.entities.add({
      position: window.Cesium.Cartesian3.fromDegrees(centerPoint.longitude, centerPoint.latitude),
      point: {
        color: window.Cesium.Color.RED,
        pixelSize: 10,
        outlineColor: window.Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: '中心点',
        font: '14px sans-serif',
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM
      }
    });

    // 创建缓冲区
    const bufferEntity = this.viewer.entities.add({
      position: window.Cesium.Cartesian3.fromDegrees(centerPoint.longitude, centerPoint.latitude),
      ellipse: {
        semiMinorAxis: radius,
        semiMajorAxis: radius,
        material: window.Cesium.Color.GREEN.withAlpha(0.3),
        outline: true,
        outlineColor: window.Cesium.Color.GREEN,
        outlineWidth: 2
      }
    });

    this.entities.push(centerEntity, bufferEntity);
    await this.viewer.zoomTo(this.viewer.entities);

    return { bufferEntity };
  }
}