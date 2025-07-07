const markerUrl = "assets/icons/Pin-User-Location-Map 10.png";
const noPhotoUrl = "assets/images/no-photo-thumb.png";

let dotnetDashboardHelper;
let currentInstallations = []; // Store current installations for redraw
let isClustering = true;

window.mapKitFunctions = {
    initializeMap: function (jwtToken, dotNetObj) {
        try {
            // Initialize MapKit with your JWT token
            mapkit.init({
                authorizationCallback: function (done) {
                    done(jwtToken);
                }
            });

            dotnetDashboardHelper = dotNetObj;

            // Create the map
            const map = new mapkit.Map("map", { mapType: mapkit.Map.MapTypes.Satellite });

            // Cluster click event
            map.addEventListener("select", function (event) {
                const annotation = event.annotation;
                if (annotation && annotation.memberAnnotations && annotation.memberAnnotations.length > 0) {
                    window.mapKitFunctions.zoomToCluster(annotation);
                }
            });

            // Zoom-end event
            map.addEventListener("zoom-end", function (event) {
                window.mapKitFunctions.trackZoomLevel();
            });

            // Store map reference globally for later use
            window.appleMap = map;

            return true;
        } catch (error) {
            console.error('Error initializing MapKit:', error);
            return false;
        }
    },

    /*
     * Adds markers to the Apple Maps view.
     *
     * Parameters:
     * - installations: An array of installation objects to be displayed as markers on the map.
     * - shouldCluster (boolean, optional): If true, nearby markers will be grouped into clusters. Defaults to true.
     * - forceFitMap (boolean, optional): If true, the map will automatically adjust its viewport to include all markers.
     *   forceFitMap is only used when the function is called via JavaScript interop from C#.
     */
    addMarker: function (installations, shouldCluster = true, forceFitMap = false) {
        if (!window.appleMap) {
            console.error('Map not initialized');
            return false;
        }

        try {
            // Store installations for redraw
            currentInstallations = Array.isArray(installations) ? installations : [installations];
            isClustering = shouldCluster;

            // Clear existing annotations before adding new ones
            this.clearAnnotations();

            // Handle both single marker and array of markers
            const markers = Array.isArray(installations) ? installations : [installations];
            const annotations = [];

            markers.forEach((marker) => {
                const installationId = marker.id;
                const lat = marker.latitude;
                const lon = marker.longitude;

                if (lat !== null && lon !== null && lat !== undefined && lon !== undefined) {
                    const coordinate = new mapkit.Coordinate(parseFloat(lat), parseFloat(lon));

                    const calloutDelegate = {
                        calloutElementForAnnotation: function (annotation) {
                            const calloutContent = document.createElement("div");
                            calloutContent.style.cssText = "max-width: 200px; font-size: 12px; padding: 0.5rem; border-radius: 8px; background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px);";

                            const imgDiv = calloutContent.appendChild(document.createElement("div"));
                            const img = imgDiv.appendChild(document.createElement("img"));
                            img.style.cssText = "width: 100%; height: 95px; object-fit: fill; border-radius: 8px;";
                            img.src = annotation.data.latestPhoto?.thumbUrl ?? noPhotoUrl;

                            const link = calloutContent.appendChild(document.createElement("a"));
                            link.href = `gallery/installation/${annotation.data.id}/photos`;
                            link.style.cssText = "display: block; color: #0A4980; font-weight: 600; text-decoration: none; margin: 0.5rem 0rem 0.2rem 0rem; outline: none;";
                            link.textContent = annotation.data.description;
                            link.title = annotation.data.description;

                            const paragraph = calloutContent.appendChild(document.createElement("p"));
                            paragraph.style.cssText = "color: #0A4980; font-weight: 500; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 180px;";
                            paragraph.textContent = (annotation.data.address == null || annotation.data.address === "" || annotation.data.address.length === 0) ? "\u00A0" : annotation.data.address;
                            paragraph.title = (annotation.data.address == null || annotation.data.address === "" || annotation.data.address.length === 0) ? "" : annotation.data.address;

                            // Call reverseGeocode to get the address
                            if (annotation.data.address === null || annotation.data.address === undefined || annotation.data.address.length === 0) {
                                window.mapKitFunctions.reverseGeocode(annotation.coordinate.latitude, annotation.coordinate.longitude)
                                    .then(address => {
                                        if (address) {
                                            paragraph.textContent = address;
                                            paragraph.title = address;
                                        }
                                    })
                                    .catch(error => {
                                        console.error('Error getting address:', error);
                                    });
                            }

                            return calloutContent;
                        },
                    };

                    // Create the marker annotation
                    const annotation = new mapkit.ImageAnnotation(coordinate, {
                        url: { 1: markerUrl },
                        size: { width: 32, height: 32 },
                        callout: calloutDelegate,
                        clusteringIdentifier: shouldCluster ? "installation-marker-cluster" : null
                    });

                    // Store original data in the annotation
                    annotation.data = marker;

                    // Marker click event
                    annotation.addEventListener('select', (event) => {
                        //window.mapKitFunctions.zoomToMarker(lat, lon);
                        if (dotnetDashboardHelper) {
                            dotnetDashboardHelper.invokeMethodAsync("OnMarkerClicked", installationId);
                        }
                    });

                    annotation.addEventListener('deselect', (event) => {
                        if (dotnetDashboardHelper) {
                            dotnetDashboardHelper.invokeMethodAsync("OnCalloutClosed");
                        }

                        setTimeout(() => {
                            window.mapKitFunctions.trackZoomLevel();
                        }, 50);
                    });

                    annotations.push(annotation);
                }
            });

            if (annotations.length > 0) {
                // Add all annotations to the map
                window.appleMap.addAnnotations(annotations);

                // Auto-fit map to show all markers
                if (forceFitMap) {
                    this.fitMapToShowAllAnnotations(annotations);
                }
            }

            return annotations.length;
        } catch (error) {
            console.error('Error adding markers:', error);
            return false;
        }
    },

    // Method to zoom into a cluster when clicked
    zoomToCluster: function (clusterAnnotation) {
        if (!clusterAnnotation.memberAnnotations || clusterAnnotation.memberAnnotations.length === 0) {
            return;
        }

        const memberCoordinates = clusterAnnotation.memberAnnotations.map(annotation => annotation.coordinate);

        // Calculate bounding region for cluster members
        let minLat = memberCoordinates[0].latitude;
        let maxLat = memberCoordinates[0].latitude;
        let minLon = memberCoordinates[0].longitude;
        let maxLon = memberCoordinates[0].longitude;

        memberCoordinates.forEach(coord => {
            minLat = Math.min(minLat, coord.latitude);
            maxLat = Math.max(maxLat, coord.latitude);
            minLon = Math.min(minLon, coord.longitude);
            maxLon = Math.max(maxLon, coord.longitude);
        });

        // Add padding around the cluster
        const latPadding = Math.max((maxLat - minLat) * 0.1, 0);
        const lonPadding = Math.max((maxLon - minLon) * 0.1, 0);

        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        const latSpan = (maxLat - minLat) + (latPadding * 2);
        const lonSpan = (maxLon - minLon) + (lonPadding * 2);

        const center = new mapkit.Coordinate(centerLat, centerLon);
        const span = new mapkit.CoordinateSpan(latSpan, lonSpan);
        const region = new mapkit.CoordinateRegion(center, span);

        window.appleMap.setRegionAnimated(region, true);
    },

    // Fit map to show all annotations
    fitMapToShowAllAnnotations: function (annotations) {
        if (!annotations || annotations.length === 0) return;

        const coordinates = annotations.map(annotation => annotation.coordinate);

        let minLat = coordinates[0].latitude;
        let maxLat = coordinates[0].latitude;
        let minLon = coordinates[0].longitude;
        let maxLon = coordinates[0].longitude;

        coordinates.forEach(coord => {
            minLat = Math.min(minLat, coord.latitude);
            maxLat = Math.max(maxLat, coord.latitude);
            minLon = Math.min(minLon, coord.longitude);
            maxLon = Math.max(maxLon, coord.longitude);
        });

        // Add padding
        const latPadding = Math.max((maxLat - minLat) * 0.1, 0.01);
        const lonPadding = Math.max((maxLon - minLon) * 0.1, 0.01);

        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        const latSpan = (maxLat - minLat) + (latPadding * 2);
        const lonSpan = (maxLon - minLon) + (lonPadding * 2);

        const center = new mapkit.Coordinate(centerLat, centerLon);
        const span = new mapkit.CoordinateSpan(latSpan, lonSpan);
        const region = new mapkit.CoordinateRegion(center, span);

        window.appleMap.setRegionAnimated(region);
    },

    zoomToMarker: function (latitude, longitude) {
        if (!window.appleMap) {
            console.error('Map not initialized');
            return false;
        }

        try {
            const center = new mapkit.Coordinate(latitude, longitude);
            const zoomSpan = 0; // Very small span = maximum zoom
            const region = new mapkit.CoordinateRegion(center, new mapkit.CoordinateSpan(zoomSpan, zoomSpan));
            window.appleMap.setRegionAnimated(region);
            return true;
        } catch (error) {
            console.error('Error setting map center:', error);
            return false;
        }
    },

    clearAnnotations: function () {
        if (!window.appleMap) {
            console.error('Map not initialized');
            return false;
        }

        try {
            window.appleMap.removeAnnotations(window.appleMap.annotations);
            return true;
        } catch (error) {
            console.error('Error clearing annotations:', error);
            return false;
        }
    },

    trackZoomLevel: function () {
        if (!window.appleMap) {
            console.error('Map not initialized');
            return;
        }

        try {
            if (window.mapKitFunctions.hasCalloutOpen()) {
                return;
            }

            const region = window.appleMap.region;
            const latSpan = region.span.latitudeDelta;

            // Approximate zoom level (smaller span = higher zoom level)
            // This is a rough heuristic; adjust as needed
            const zoomLevel = Math.round(20 - Math.log2(latSpan) * 2);

            // Define zoom threshold for remove clustering
            const ZOOM_THRESHOLD_FOR_REMOVE_CLUSTER = 30;

            // Redraw markers based on zoom level
            if (zoomLevel >= ZOOM_THRESHOLD_FOR_REMOVE_CLUSTER && isClustering) {
                window.mapKitFunctions.addMarker(currentInstallations, false);
            } else if (zoomLevel < ZOOM_THRESHOLD_FOR_REMOVE_CLUSTER && !isClustering) {
                window.mapKitFunctions.addMarker(currentInstallations, true);
            }
        } catch (error) {
            console.error('Error tracking zoom level:', error);
        }
    },

    openCalloutForMarker: function (installationId) {
        if (!window.appleMap) {
            console.error('Map not initialized');
            return false;
        }

        try {
            // Find the marker annotation with the matching installationId
            const annotation = window.appleMap.annotations.find(
                ann => ann.data && ann.data.id === installationId && ann instanceof mapkit.ImageAnnotation
            );

            if (!annotation) {
                console.error(`No marker found for installation ID: ${installationId}`);
                return false;
            }

            // Ensure the marker is selected and show its callout
            window.appleMap.selectedAnnotation = annotation;

            return true;
        } catch (error) {
            console.error('Error opening callout:', error);
            return false;
        }
    },

    hasCalloutOpen: function () {
        if (!window.appleMap) {
            console.error('Map not initialized');
            return false;
        }

        try {
            // Check if there is a selected annotation
            return !!window.appleMap.selectedAnnotation;
        } catch (error) {
            console.error('Error checking for open callout:', error);
            return false;
        }
    },

    reverseGeocode: function (latitude, longitude) {
        return new Promise((resolve, reject) => {
            const coordinate = new mapkit.Coordinate(latitude, longitude);
            const geocoder = new mapkit.Geocoder();

            geocoder.reverseLookup(coordinate, (error, data) => {
                if (error) {
                    console.error("Reverse geocoding failed:", error);
                    reject(error);
                    return;
                }

                if (data && data.results.length > 0) {
                    const result = data.results[0];
                    resolve(result.formattedAddress);
                } else {
                    console.warn("No results found for reverse geocoding.");
                    resolve("");
                }
            });
        });
    }
};