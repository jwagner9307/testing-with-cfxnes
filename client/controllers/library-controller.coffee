angular.module "nescoffee"

.controller "LibraryController", ($scope, $state, $timeout, library, emulator, globalParams) ->
    $scope.romsFilter = globalParams.romsFilter ?= { name: "" }

    $scope.isSelectedROM = (rom) ->
        $scope.selectedROM is rom

    $scope.selectROM = (rom) ->
        $scope.selectedROM = rom

    $scope.moveROMSelection = (increment) ->
        index = $scope.filteredROMs.indexOf $scope.selectedROM
        index = Math.max(0, Math.min($scope.filteredROMs.length - 1, index + increment))
        $scope.selectedROM = $scope.filteredROMs[index]
        $timeout ->
            # Scroll to the selected row when it's out of visible area
            table = $("#library")
            selectedRow = $("#library tr.info")
            if increment < 0
                tableTop = table.offset().top
                selectedRowTop = selectedRow.offset().top
                if selectedRowTop < tableTop
                    selectedRow[0].scrollIntoView true
            else if increment > 0
                tableBottom = table.offset().top + table.height()
                selectedRowBottom = selectedRow.offset().top + selectedRow.height()
                if selectedRowBottom > tableBottom
                    selectedRow[0].scrollIntoView false

    $scope.romSelectionKeyInput = (event) ->
        if $scope.loadingDone
            eventUsed = true
            switch event.keyCode
                when 13 then $scope.playSelectedROM()                    # Enter
                when 33 then $scope.moveROMSelection -10                 # Page up
                when 34 then $scope.moveROMSelection +10                 # Page up
                when 35 then $scope.moveROMSelection +$scope.roms.length # End
                when 36 then $scope.moveROMSelection -$scope.roms.length # Home
                when 38 then $scope.moveROMSelection -1                  # Up
                when 40 then $scope.moveROMSelection +1                  # Down
                else eventUsed = false
            event.preventDefault() if eventUsed


    $scope.playROM = (rom) ->
        library.getROM rom.id
            .success (data) ->
                $scope.playError = emulator.insertCartridge data
                unless $scope.playError
                    emulator.start()
                    $state.go "emulator"
            .error (data, status) ->
                $scope.playError = "Unable to download file (server response: #{status})."

    $scope.playSelectedROM = ->
        $scope.playROM $scope.selectedROM if $scope.selectedROM

    $scope.clearError = ->
        $scope.playError = null

    library.listROMs()
        .success (data) ->
            $scope.roms = data
            $scope.loadingDone = true
        .error (data, status) ->
            $scope.loadingError = "Unable to download game list (server response: #{status})."
            $scope.loadingDone = true