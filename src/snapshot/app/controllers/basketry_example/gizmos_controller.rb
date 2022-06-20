# This code was generated by @basketry/rails@{{version}}
#
# Changes to this file may cause incorrect behavior and will be lost if
# the code is regenerated.
#
# To make changes to the contents of this file:
# 1. Edit source/path.ext
# 2. Run the Basketry CLI
#
# About Basketry: https://github.com/basketry/basketry/wiki
# About @basketry/rails: https://github.com/basketry/rails#readme

module BasketryExample
  class GizmosController < ApplicationController
    include BasketryExample::ControllerHelpers

    def get_gizmos
      response = services.gizmo_service.get_gizmos(
        search: params['search']
      )

      render json: map_gizmos_response_to_dto(response), status: status_code(response.errors) || 200
    end

    def create_gizmo
      response = services.gizmo_service.create_gizmo(
        size: params['size']
      )

      render json: map_gizmo_to_dto(response), status: status_code(response.errors) || 201
    end

    def update_gizmo
      response = services.gizmo_service.update_gizmo(
        factors: params['factors']&.split(',')
      )

      render json: map_gizmo_to_dto(response), status: status_code(response.errors) || 200
    end
  end
end
