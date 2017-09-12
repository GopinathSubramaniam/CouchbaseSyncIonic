// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
var couchbaseApp = angular.module('starter', ['ionic', 'ngCouchbaseLite']);

var todoDatabase = null;
couchbaseApp.run(function($ionicPlatform, $ionicPopup, $couchbase) {
    $ionicPlatform.ready(function() {
        if (window.cordova && window.cordova.plugins.Keyboard) {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

            // Don't remove this line unless you know what you are doing. It stops the viewport
            // from snapping when text inputs are focused. Ionic handles this internally for
            // a much nicer keyboard experience.
            cordova.plugins.Keyboard.disableScroll(true);
        }
        if (window.StatusBar) {
            StatusBar.styleDefault();
        }

        if (!window.cblite) {
            $ionicPopup.alert({ title: 'Couchbase Lite is not installed' });
        } else {
            cblite.getURL(function(err, url) {
                if (err) {
                    $ionicPopup.alert({ title: 'There was an error in retrieving couchbase URL' });
                    return;
                }
                console.log('URL = ', url);
                todoDatabase = new $couchbase(url, 'sync_gateway');
                todoDatabase.createDatabase().then(function(result) {
                    var todoViews = {
                        lists: {
                            map: function(doc) {
                                if (doc.type == 'list' && doc.title) {
                                    emit(doc.id, doc);
                                }
                            }.toString()
                        }
                    };
                    todoDatabase.createDesignDocument('_design/sync_gateway', todoViews);
                    todoDatabase.listen();
                }, function(err) {
                    $ionicPopup.alert({ title: 'Error while creating database' });
                });
            });
        }

    });
});

couchbaseApp.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider.state("login", {
            url: "/login",
            templateUrl: "templates/login.html",
            controller: "LoginController"
        })
        .state('todoLists', {
            url: '^/todoLists',
            templateUrl: 'templates/todolists.html',
            controller: 'TodoListsController'
        });

    $urlRouterProvider.otherwise('/login');
});

couchbaseApp.controller('LoginController', function($scope, $state, $ionicHistory) {
    $ionicHistory.nextViewOptions({
        disableAnimate: true,
        disableBack: true
    });

    $scope.basicLogin = function() {
        todoDatabase.replicate("sync_gateway", "http://192.168.0.107:4984/sync_gateway", true).then(function(result) {
            todoDatabase.replicate("http://192.168.0.107:4984/sync_gateway", "sync_gateway", true).then(function(result) {
                $state.go("todoLists");
                console.log('Replica Started!!.');
            }, function(error) {
                // There was an error replicating to the local device
                console.log('There was an error replicating to the local device');
            });
        }, function(error) {
            console.log('There was an error replicating to the Sync Gateway.');
            // There was an error replicating to the Sync Gateway
        });
    };
});


couchbaseApp.controller('TodoListsController', function($scope, $state, $ionicPopup, $couchbase, $rootScope) {
    $scope.lists = {};
    $scope.insert = function() {
        $ionicPopup.prompt({
            title: 'Enter new user',
            inputType: 'text',
        }).then(function(result) {
            var obj = { title: result, type: 'list', owner: "guest" };
            todoDatabase.createDocument(obj).then(function(result) {
                alert('Document created!');
            }, function(err) {
                alert('Document did not created');
            });
        });
    };

    $scope.delete = function(list) {
        var listId = list._id;
        todoDatabase.deleteDocument(list._id, list._rev).then(function(result) {

        }, function(error) {
            // There was an error deleting the list document
        });
    };

    $scope.update = function() {

    };

    if (todoDatabase) {
        todoDatabase.queryView('_design/sync_gateway', 'lists').then(function(result) {
            for (var i = 0; i < result.rows.length; i++) {
                $scope.lists[result.rows[i].id] = result.rows[i].value;
            }
        }, function(err) {

        });
    }


    $rootScope.$on("couchbase:change", function(event, args) {
        for (var i = 0; i < args.results.length; i++) {
            if (args.results[i].hasOwnProperty("deleted") && args.results[i].deleted === true) {
                delete $scope.lists[args.results[i].id];
            } else {
                if (args.results[i].id.indexOf("_design") === -1) {
                    todoDatabase.getDocument(args.results[i].id).then(function(result) {
                        $scope.lists[result._id] = result;
                    });
                }
            }
        }
    });

});